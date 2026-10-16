"""
AdNexus Support Chatbot — FastAPI router
-----------------------------------------
  1. Rule-based intent matching for common queries -> instant auto-reply
     (greetings, thanks, bye, "talk to human", platform how-tos).
  2. Anything that doesn't match a rule -> Groq API (free tier,
     openai/gpt-oss-120b, falls back to openai/gpt-oss-20b) generates a
     reply, grounded with an AdNexus-specific system prompt.
  3. If the LLM is unsure / the user asks for a human, or the API call fails,
     the session is saved as pending_human and your admin team can reply
     manually (see the admin_router endpoints below / AdminChatPanel.jsx).

Language behaviour:
  - Replies are in ENGLISH by default (including the first message / greetings).
  - If the user writes in Hindi / Hinglish, the reply switches to Hinglish.

Setup:
    pip install groq python-dotenv
    Add to .env:  GROQ_API_KEY=gsk_...
    (optional)    GROQ_MODEL=llama-3.3-70b-versatile
    (optional)    GROQ_MODEL_FALLBACK=openai/gpt-oss-20b
    Support team:  SUPPORT_USER_EMAIL=support@yourdomain.com   (comma-separate for several)
                   SUPPORT_INBOX_URL=https://yourdomain.com/support-inbox
    Email alerts:  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

Drop this file in your FastAPI app (e.g. app/routes/chat_router.py) and include it:
    from app.routes import chat_router
    app.include_router(chat_router.router, prefix="/api")
    app.include_router(chat_router.admin_router, prefix="/api/admin")
"""

import os
import re
import time                                   # [GROQ] new — rate limit
import uuid
import logging
import smtplib
from email.message import EmailMessage
from collections import defaultdict, deque    # [GROQ] new — rate limit
from datetime import datetime
from typing import Optional, List, Literal

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Session

from app.models.models import Base, User, Notification   # same Base your other models use
from app.database import get_db      # your existing DB session dependency
# ^ if get_db lives elsewhere (e.g. app.database.database), adjust this import
#   to match wherever campaigns.py / leads.py import it from.

# Make sure GROQ_API_KEY from .env is loaded even if main.py forgot to do it
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger("adnexus.chat")

# ---------------------------------------------------------------------------
# Login check for the support (admin) routes
# ---------------------------------------------------------------------------
# !! Use the SAME import your other routers use to get the logged-in user.
#    Open the file that defines /notifications/unread-count (search "unread-count"
#    in backend/) and copy the import line it uses for the current user.
try:
    from app.routes.auth import get_current_user   # <-- CHANGE THIS LINE if your path/name differs
except ImportError:
    get_current_user = None
    logger.error(
        "get_current_user could not be imported - support routes stay LOCKED "
        "until you fix the import at the top of chat_router.py"
    )


# ---------------------------------------------------------------------------
# LLM toggle — on by default, using Groq's free tier
# ---------------------------------------------------------------------------
LLM_ENABLED = True  # set False any time to fall back to pure admin-queue mode

# [GROQ] replaces GEMINI_MODEL_NAME
GROQ_MODEL_MAIN = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_MODEL_FALLBACK = os.getenv("GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b")
ESCALATE_TOKEN = "[[ESCALATE]]"

# Email of the dedicated support user — gets a bell notification on every new escalation.
# Add to .env:  SUPPORT_USER_EMAIL=support@yourdomain.com
# More than one support person? Comma-separate: a@x.com,b@x.com
# These accounts (a) get the bell + email alert and (b) are the ONLY ones who can open the inbox.
SUPPORT_EMAILS = [e.strip().lower() for e in (os.getenv("SUPPORT_USER_EMAIL") or "").split(",") if e.strip()]
SUPPORT_INBOX_URL = os.getenv("SUPPORT_INBOX_URL", "http://localhost:3000/support-inbox")

# Email alert settings (same SMTP account you use for OTP emails works fine):
#   SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=...  SMTP_PASSWORD=...  SMTP_FROM=...
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER


# ---------------------------------------------------------------------------
# DB Models
# ---------------------------------------------------------------------------
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=True)  # null = anonymous/guest user
    status = Column(String, default="open")  # "open" | "pending_human" | "resolved"
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant" | "admin"
    content = Column(Text, nullable=False)
    source = Column(String, nullable=True)  # "rule" | "llm" | "pending" | "admin"
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    source: Literal["rule", "llm", "pending"]
    quick_replies: List[str] = []
    escalate: bool = False


class AdminReplyRequest(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Language detection (English by default, Hinglish only if the user uses it)
# ---------------------------------------------------------------------------
HINGLISH_WORDS = {
    "kaise", "kese", "kaisa", "kya", "kyu", "kyun", "kyon", "hai", "hain", "nahi", "nhi",
    "karo", "karna", "kare", "kar", "mujhe", "mera", "meri", "mere", "hum", "humein",
    "aap", "apna", "apne", "batao", "bata", "bataiye", "chahiye", "hoga", "raha", "rahi",
    "rha", "rhi", "mein", "naya", "nayi", "dikhao", "madad", "sawaal", "sawal", "puch",
    "pucho", "kaha", "kahan", "kab", "kaun", "kuch", "yeh", "ye", "wo", "woh", "toh",
    "bhi", "abhi", "lekin", "aur", "kaam", "samajh", "namaste", "dhanyavaad", "shukriya",
    "jaldi", "theek", "sahi", "galat", "wala", "wali", "hota", "hoti", "sakta", "sakte",
}


def is_hinglish(text: str) -> bool:
    """True if the message contains Devanagari or common Roman-Hindi words."""
    if re.search(r"[\u0900-\u097F]", text):
        return True
    words = set(re.findall(r"[a-z]+", text.lower()))
    return len(words & HINGLISH_WORDS) > 0


def pick(texts: dict, hinglish: bool):
    """texts = {"en": ..., "hi": ...} -> returns the right variant."""
    return texts["hi"] if hinglish else texts["en"]


# ---------------------------------------------------------------------------
# Rule-based intent matching
# ---------------------------------------------------------------------------
# Each intent: keywords (regex, case-insensitive) -> canned response + quick replies,
# each available in English ("en") and Hinglish ("hi").
# An intent with "escalate": True hands the chat to the support team.
# Keep this list growing based on which queries end up "pending" most often
# (see GET /api/admin/chat/sessions?status=pending_human).
INTENTS = [
    # [GROQ] NEW — user explicitly asks for a human -> straight to admin queue
    {
        "name": "human_request",
        "escalate": True,
        "patterns": [
            r"\b(human|real person|live agent|support (team|executive|agent)|customer care|talk to (a |an )?(person|someone|human)|baat karni)\b"
        ],
        "response": {
            "en": "Sure — I've passed this chat to our support team. Please wait here; our team will connect with you in this same chat shortly.",
            "hi": "Theek hai — maine ye chat support team ko bhej di hai. Kripya yahin wait karein, hamari team isi chat mein aapse jald connect karegi.",
        },
        "quick_replies": {"en": [], "hi": []},
    },
    {
        "name": "greeting",
        "patterns": [r"^\s*(hi+|hello+|hey+|hlo+|helo+|namaste|good (morning|afternoon|evening))\s*[!.?]*\s*$"],
        "response": {
            "en": (
                "Hi! I'm the AdNexus support assistant. You can ask me anything about "
                "campaigns, leads, or connecting your ad platforms."
            ),
            "hi": (
                "Hi! Main AdNexus support assistant hoon. Campaigns, leads, ya platform "
                "connection ke baare mein kuch bhi puch sakte ho."
            ),
        },
        "quick_replies": {
            "en": ["How do I create a campaign?", "How do I connect a platform?"],
            "hi": ["Campaign kaise banate hain?", "Platform kaise connect kare?"],
        },
    },
    # [GROQ] NEW — thanks / ok  (this was the "thank you -> support team" bug)
    {
        "name": "thanks",
        "patterns": [
            r"^\s*(thanks+|thank\s*you|thankyou|thx|ty|shukriya|dhanyavaad|dhanyawad)(\s+(a lot|so much|very much|bhai|sir))?\s*[!.]*\s*$",
            r"^\s*(ok+|okay|okk+|got it|great|nice|cool|theek hai|thik hai|accha|acha)\s*[!.]*\s*$",
        ],
        "response": {
            "en": "You're welcome! Let me know if you need help with anything else.",
            "hi": "Koi baat nahi! Aur kuch madad chahiye to bata dena.",
        },
        "quick_replies": {"en": [], "hi": []},
    },
    # [GROQ] NEW — bye
    {
        "name": "bye",
        "patterns": [r"^\s*(bye+|goodbye|good bye|see you|tata|alvida)\s*[!.]*\s*$"],
        "response": {
            "en": "Goodbye! Come back anytime you need help.",
            "hi": "Bye! Jab bhi madad chahiye, wapas aa jana.",
        },
        "quick_replies": {"en": [], "hi": []},
    },
    {
        "name": "create_campaign",
        "patterns": [r"create.*campaign", r"campaign.*(kaise|kese|how)", r"naya campaign"],
        "response": {
            "en": (
                "To create a new campaign, click 'Create Campaign' on the Dashboard. "
                "In Step 2 (Platforms) of the wizard you'll connect your Google/Meta ads account, "
                "then set your targeting and budget and launch."
            ),
            "hi": (
                "Naya campaign banane ke liye Dashboard se 'Create Campaign' pe click karo. "
                "Wizard mein Step 2 (Platforms) mein apna Google/Meta ads account connect karna hoga, "
                "phir targeting aur budget set karke launch kar sakte ho."
            ),
        },
        "quick_replies": {
            "en": ["How do I connect a platform?", "How do I set a budget?"],
            "hi": ["Platform kaise connect kare?", "Budget kaise set kare?"],
        },
    },
    {
        "name": "connect_platform",
        "patterns": [r"connect.*(account|platform|meta|google)", r"oauth", r"platform.*link"],
        "response": {
            "en": (
                "To connect a platform, go to Step 2 of the Create Campaign wizard — each "
                "platform card has a 'Connect Account' button. Clicking it opens the OAuth flow "
                "where you log in with your Google/Meta account and grant permission."
            ),
            "hi": (
                "Platform connect karne ke liye CreateCampaign wizard ke Step 2 mein jao — "
                "har platform card pe 'Connect Account' button milega. Click karte hi OAuth flow "
                "khulega jaha apne Google/Meta account se login karke permission dena hoga."
            ),
        },
        "quick_replies": {
            "en": ["Google Ads won't connect", "Meta Ads won't connect"],
            "hi": ["Google Ads connect nahi ho raha", "Meta Ads connect nahi ho raha"],
        },
    },
    {
        "name": "lead_status",
        "patterns": [r"lead.*status", r"lead.*kaise dekh", r"lead.*track"],
        "response": {
            "en": (
                "The Leads section shows a status timeline for every lead — New, Contacted, "
                "Follow-up, Converted. Click the status to update it, and you can also set a "
                "follow-up date."
            ),
            "hi": (
                "Leads section mein har lead ka status timeline dikhta hai — New, Contacted, "
                "Follow-up, Converted. Status pe click karke update kar sakte ho, aur follow-up "
                "date bhi set kar sakte ho."
            ),
        },
        "quick_replies": {
            "en": ["How do I contact a lead on WhatsApp?"],
            "hi": ["WhatsApp se lead contact kaise kare?"],
        },
    },
    {
        "name": "whatsapp_lead",
        "patterns": [r"whatsapp"],
        "response": {
            "en": (
                "In a lead's detail modal you'll find a WhatsApp icon — click it and a WhatsApp "
                "chat opens directly with that lead's number."
            ),
            "hi": (
                "Lead ke detail modal mein WhatsApp icon milega — click karte hi seedha us lead "
                "ke number pe WhatsApp chat khul jayegi."
            ),
        },
        "quick_replies": {"en": [], "hi": []},
    },
]


def match_intent(message: str):
    msg = message.lower().strip()
    for intent in INTENTS:
        for pattern in intent["patterns"]:
            if re.search(pattern, msg):
                return intent
    return None


# ---------------------------------------------------------------------------
# LLM fallback — Groq (free tier)                         [GROQ] replaces Gemini
# ---------------------------------------------------------------------------
ADNEXUS_SYSTEM_PROMPT = """You are the AdNexus support assistant. AdNexus is a B2B SaaS \
ad campaign management platform for SMBs and digital marketing agencies in India. Features \
include: campaign creation wizard, lead management with status timelines, AI-generated ad \
content, Google Ads, Meta/Facebook/Instagram Ads and LinkedIn Ads integration (via OAuth, each \
user connects their own ad account), WhatsApp integration for lead contact, and an admin dashboard.

Rules:
- Only answer questions about using the AdNexus platform.
- A user message may begin with [Help-center notes] ... [End of notes]. Treat those notes as the source of truth for specific steps, features and policies: answer from them and never contradict them. Never mention the notes themselves.
- Handle greetings, thanks and small talk naturally. Never escalate for those.
- If you do not know a specific detail (exact pricing, an undocumented feature, account-specific \
issues), say you're not sure — do NOT guess or invent details — and end your reply with the \
exact token [[ESCALATE]].
- If the user asks for a human or the support team, tell them you're connecting them and end \
with [[ESCALATE]].
- Use [[ESCALATE]] only in those two cases, nowhere else.
- Keep answers short (2-4 sentences) and practical.
- LANGUAGE: Reply in English by default. If the user writes Hindi or Hinglish, reply in Hinglish \
(Hindi in Roman script). Each user message may end with "[Reply language: English]" or \
"[Reply language: Hinglish]" — follow it and never repeat that line.
- Never share internal details (database structure, API keys, backend code).
"""

_groq_client = None


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set (check your .env and restart the server)")
        from groq import Groq
        _groq_client = Groq(api_key=api_key, timeout=20.0, max_retries=1)
    return _groq_client


def call_llm_fallback(message: str, history: List[dict], hinglish: bool,
                      kb_context: str = "") -> tuple[str, bool]:
    """Returns (reply_text, should_escalate_to_human)."""
    from groq import RateLimitError, APIStatusError, APIConnectionError

    client = _get_groq_client()
    lang_hint = "Hinglish" if hinglish else "English"
    messages = [{"role": "system", "content": ADNEXUS_SYSTEM_PROMPT}]
    messages += [{"role": h["role"], "content": h["content"]} for h in history]
    notes = f"[Help-center notes]\n{kb_context}\n[End of notes]\n\n" if kb_context else ""
    messages.append({"role": "user", "content": f"{notes}User question: {message}\n\n[Reply language: {lang_hint}]"})

    last_err = None
    for model in (GROQ_MODEL_MAIN, GROQ_MODEL_FALLBACK):   # 70B fail / rate-limit -> 8B
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=1024,            # gpt-oss counts its "thinking" tokens too, so keep headroom
                reasoning_effort="low",     # fast + cheap, enough for support answers
            )
            reply = (resp.choices[0].message.content or "").strip()
            if not reply:
                raise RuntimeError("Groq returned an empty reply")
            escalate = ESCALATE_TOKEN in reply
            reply = reply.replace(ESCALATE_TOKEN, "").strip()
            return reply, escalate
        except (RateLimitError, APIConnectionError, APIStatusError) as e:
            logger.warning("Groq model %s failed: %s", model, e)
            last_err = e
    raise last_err


# --- simple in-memory rate limit for LLM calls (protects the free quota) ---
# Note: per-worker only. Behind nginx/proxy use X-Forwarded-For instead of request.client.host.
_LLM_CALLS = defaultdict(deque)
LLM_LIMIT, LLM_WINDOW = 10, 60   # 10 LLM replies / minute / client


def allow_llm_call(key: str) -> bool:
    now = time.time()
    q = _LLM_CALLS[key]
    while q and now - q[0] > LLM_WINDOW:
        q.popleft()
    if len(q) >= LLM_LIMIT:
        return False
    q.append(now)
    return True


SLOW_DOWN_REPLY = {
    "en": "You're sending messages quite fast — please wait a few seconds and try again.",
    "hi": "Aap bahut tezi se messages bhej rahe ho — kuch second ruk kar dobara try karo.",
}

PENDING_REPLY = {
    "en": "I've sent your question to our support team. Please wait here — our team will connect with you in this same chat shortly.",
    "hi": "Maine aapka sawaal hamari support team ko bhej diya hai. Kripya yahin wait karein — hamari team isi chat mein aapse jald connect karegi.",
}

# ---------------------------------------------------------------------------
# Help-center knowledge base — simple keyword retrieval (no extra packages, free).
# Edit knowledge_base.md (next to this file); changes are picked up automatically.
# ---------------------------------------------------------------------------
KB_PATH = os.getenv("KB_PATH") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_base.md")
_KB_STOP = {
    "the", "and", "for", "with", "this", "that", "have", "from", "your", "you", "are", "can",
    "how", "what", "why", "when", "where", "does", "not", "but", "please", "will", "would",
    "should", "could", "any", "all", "get", "has", "was", "were", "its", "our", "out", "who",
}
_kb_cache = {"mtime": None, "chunks": []}


def _kb_tokens(text: str) -> set:
    return {
        w for w in re.findall(r"[a-z0-9\u0900-\u097F]+", text.lower())
        if len(w) > 2 and w not in _KB_STOP
    }


def _load_kb() -> list:
    """Parse knowledge_base.md ('## Title' sections) into chunks; re-reads when the file changes."""
    try:
        mtime = os.path.getmtime(KB_PATH)
    except OSError:
        return []
    if _kb_cache["mtime"] == mtime:
        return _kb_cache["chunks"]
    with open(KB_PATH, encoding="utf-8") as f:
        raw = f.read()
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.S)          # lets you keep unfinished templates as comments
    chunks = []
    for block in re.split(r"(?m)^## ", raw)[1:]:
        title, _, body = block.partition("\n")
        title, body = title.strip(), body.strip()
        if not title or not body:
            continue
        kw = re.search(r"(?im)^keywords:\s*(.+)$", body)
        keywords = kw.group(1) if kw else ""
        text_body = re.sub(r"(?im)^keywords:.*$", "", body).strip()
        chunks.append({
            "title": title,
            "text": text_body,
            "title_tokens": _kb_tokens(title + " " + keywords),
            "body_tokens": _kb_tokens(text_body),
        })
    _kb_cache["mtime"] = mtime
    _kb_cache["chunks"] = chunks
    return chunks


def retrieve_kb(question: str, k: int = 3) -> str:
    """Top-k most relevant knowledge-base sections for the question (empty string if none)."""
    q = _kb_tokens(question)
    if not q:
        return ""
    scored = []
    for c in _load_kb():
        score = 3 * len(q & c["title_tokens"]) + len(q & c["body_tokens"])
        if score > 0:
            scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return "\n\n".join(f"[{c['title']}]\n{c['text']}" for _, c in scored[:k])


# Chat states: open (bot) -> pending_human (waiting for support) -> answered
# (support replied, still with support) -> resolved (support closed it, bot is back)
HUMAN_STATUSES = ("pending_human", "answered")

HANDOFF_ACK = {
    "en": "Noted — our support team will see your message and reply here.",
    "hi": "Theek hai — hamari support team aapka message dekhkar yahin reply karegi.",
}

# Appended to the LLM's own reply when it escalates
WAIT_NOTE = {
    "en": "Please wait here — our support team will connect with you in this same chat shortly.",
    "hi": "Kripya yahin wait karein — hamari support team isi chat mein aapse jald connect karegi.",
}


def _send_email(to_list: List[str], subject: str, body: str):
    """Plain SMTP email. Runs in a background task, so a slow mail server never slows the chat."""
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        logger.warning("SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD) - support email skipped")
        return
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = ", ".join(to_list)
        msg.set_content(body)
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls()
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
    except Exception:
        logger.exception("Support email failed")


def _notify_support(db: Session, session_id: str, last_user_message: str,
                    background_tasks: BackgroundTasks):
    """Tell the support team a chat needs a human: bell notification + email. Must never break the chat."""
    try:
        if not SUPPORT_EMAILS:
            logger.warning("SUPPORT_USER_EMAIL not set - support team not notified")
            return

        # who is asking?
        chat_session = db.query(ChatSession).filter_by(id=session_id).first()
        who = "Guest visitor (not logged in)"
        if chat_session and chat_session.user_id and str(chat_session.user_id).isdigit():
            u = db.query(User).filter(User.id == int(chat_session.user_id)).first()
            if u:
                who = f"{u.name} ({u.email})"

        preview = last_user_message.strip()[:120]

        # 1) bell notification for each support account
        supporters = db.query(User).filter(User.email.in_(SUPPORT_EMAILS)).all()
        if not supporters:
            logger.warning("No user found for SUPPORT_USER_EMAIL=%s - no bell notification", SUPPORT_EMAILS)
        for sup in supporters:
            db.add(Notification(
                user_id=sup.id,
                title="New support chat request",
                message=f'{who}: "{preview}" — open the support inbox to reply.',
                type="warning",
            ))
        db.commit()

        # 2) email (background, so the user's chat is not delayed)
        body = (
            "A user needs help from a human on the AdNexus support chat.\n\n"
            f"From: {who}\n"
            f"Message: {last_user_message.strip()}\n"
            f"Chat ID: {session_id}\n\n"
            f"Open the support inbox to reply: {SUPPORT_INBOX_URL}\n"
        )
        background_tasks.add_task(_send_email, SUPPORT_EMAILS, "AdNexus: new support chat request", body)
    except Exception:
        db.rollback()
        logger.exception("Support notification failed")


# ---------------------------------------------------------------------------
# User-facing router
# ---------------------------------------------------------------------------
router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request, background_tasks: BackgroundTasks,
         db: Session = Depends(get_db)):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    hinglish = is_hinglish(req.message)
    client_ip = request.client.host if request.client else "unknown"           # [GROQ] new

    # 1. Get or create session
    session_id = req.session_id or None
    clean_user_id = req.user_id or None  # treat "" as no user (avoids FK/type errors)
    session = None
    if session_id:
        session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        session = ChatSession(user_id=clean_user_id, status="open")
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id
    prev_status = session.status   # used to notify support only on a NEW escalation

    # 2. Save incoming user message
    db.add(ChatMessage(session_id=session_id, role="user", content=req.message))
    db.commit()

    # 3. Rule-based match first (free + instant)                    [GROQ] block rewritten
    in_handoff = prev_status in HUMAN_STATUSES
    intent = None if in_handoff else match_intent(req.message)
    quick_replies: List[str] = []

    if in_handoff:
        # Chat is with the support team: the bot stays quiet, support gets the message
        reply_text = pick(HANDOFF_ACK, hinglish)
        source, escalate = "pending", True
        if prev_status == "answered":
            session.status = "pending_human"   # user wrote after support replied -> back in the queue

    elif intent:
        reply_text = pick(intent["response"], hinglish)
        quick_replies = pick(intent.get("quick_replies", {"en": [], "hi": []}), hinglish)
        escalate = bool(intent.get("escalate"))
        source = "pending" if escalate else "rule"
        if escalate:
            session.status = "pending_human"

    elif LLM_ENABLED and not allow_llm_call(client_ip):
        reply_text = pick(SLOW_DOWN_REPLY, hinglish)
        source, escalate = "rule", False

    elif LLM_ENABLED:
        history_rows = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id, ChatMessage.role.in_(["user", "assistant"]))
            .order_by(ChatMessage.created_at.desc())
            .limit(12)
            .all()
        )
        # history_rows[0] is the message we just saved, so skip it
        history = [{"role": r.role, "content": r.content} for r in reversed(history_rows[1:])]
        try:
            reply_text, escalate = call_llm_fallback(
                req.message, history, hinglish, retrieve_kb(req.message)
            )
            source = "llm"
            if escalate:
                session.status = "pending_human"   # previously missing: admin queue never saw LLM escalations
                reply_text = (
                    f"{reply_text}\n\n{pick(WAIT_NOTE, hinglish)}" if reply_text
                    else pick(PENDING_REPLY, hinglish)
                )
        except Exception:
            # Log the REAL error so you can see it in the backend terminal
            logger.exception("Groq call failed")
            reply_text = pick(PENDING_REPLY, hinglish)
            source, escalate = "pending", True
            session.status = "pending_human"

    else:
        # No LLM configured — hand off to the admin queue.
        reply_text = pick(PENDING_REPLY, hinglish)
        source, escalate = "pending", True
        session.status = "pending_human"

    # 4. Save assistant reply + persist session status
    db.add(ChatMessage(session_id=session_id, role="assistant", content=reply_text, source=source))
    db.add(session)
    db.commit()

    # 5. Tell the dedicated support user (bell notification) on a NEW escalation
    if escalate and prev_status != "pending_human":
        _notify_support(db, session_id, req.message, background_tasks)

    return ChatResponse(
        session_id=session_id,
        reply=reply_text,
        source=source,
        quick_replies=quick_replies,
        escalate=escalate,
    )


@router.get("/chat/{session_id}/history")
def get_history(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")

    messages = (
        db.query(ChatMessage)
        .filter_by(session_id=session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat(),
            "session_status": session.status,
        }
        for m in messages
    ]


# ---------------------------------------------------------------------------
# Admin router — mount separately so you can put it behind your existing
# admin-auth dependency. In main.py:
#   from app.routes import chat_router
#   app.include_router(chat_router.router, prefix="/api")
#   app.include_router(chat_router.admin_router, prefix="/api/admin")
# ---------------------------------------------------------------------------
def _auth_unavailable():
    raise HTTPException(status_code=503, detail="Support login check is not configured on the server")


def _email_of(current_user) -> str:
    if isinstance(current_user, dict):
        email = current_user.get("email")
    elif isinstance(current_user, str):
        email = current_user
    else:
        email = getattr(current_user, "email", None)
    return (email or "").strip().lower()


def require_support_user(current_user=Depends(get_current_user or _auth_unavailable)):
    """Only the accounts listed in SUPPORT_USER_EMAIL may use the support (admin) routes."""
    if _email_of(current_user) not in SUPPORT_EMAILS:
        raise HTTPException(status_code=403, detail="Support access only")
    return current_user


@router.get("/chat/is-support")
def is_support(current_user=Depends(get_current_user or _auth_unavailable),
               db: Session = Depends(get_db)):
    """Used by the dashboard: show the 'Support Inbox' menu (with a waiting-count badge)
    only to support accounts. Everyone else just gets is_support = false."""
    if _email_of(current_user) not in SUPPORT_EMAILS:
        return {"is_support": False, "waiting": 0}
    waiting = db.query(ChatSession).filter(ChatSession.status == "pending_human").count()
    return {"is_support": True, "waiting": waiting}


# every route on this router needs a logged-in support user
admin_router = APIRouter(tags=["chat-admin"], dependencies=[Depends(require_support_user)])


@admin_router.get("/chat/sessions")
def list_sessions(status: Optional[str] = None, db: Session = Depends(get_db)):
    """
    List chat sessions. `status` can be one value or comma-separated, e.g.
    ?status=pending_human,answered   (open | pending_human | answered | resolved).
    Waiting chats first (longest wait on top), then the rest newest first.
    """
    query = db.query(ChatSession)
    if status:
        statuses = [x.strip() for x in status.split(",") if x.strip()]
        query = query.filter(ChatSession.status.in_(statuses))
    sessions = query.all()

    result = []
    for s in sessions:
        last_msg = (
            db.query(ChatMessage)
            .filter_by(session_id=s.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        user_name = user_email = None
        if s.user_id and str(s.user_id).isdigit():
            u = db.query(User).filter(User.id == int(s.user_id)).first()
            if u:
                user_name, user_email = u.name, u.email
        result.append({
            "session_id": s.id,
            "user_id": s.user_id,
            "user_name": user_name,
            "user_email": user_email,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
            "last_message": last_msg.content if last_msg else None,
            "last_role": last_msg.role if last_msg else None,
            "updated_at": (last_msg.created_at if last_msg else s.created_at).isoformat(),
        })
    waiting = sorted((r for r in result if r["status"] == "pending_human"), key=lambda r: r["updated_at"])
    rest = sorted((r for r in result if r["status"] != "pending_human"), key=lambda r: r["updated_at"], reverse=True)
    return waiting + rest   # longest-waiting user first


@admin_router.get("/chat/sessions/{session_id}/messages")
def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")

    messages = (
        db.query(ChatMessage)
        .filter_by(session_id=session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return {
        "session_id": session_id,
        "status": session.status,
        "messages": [
            {"role": m.role, "content": m.content, "source": m.source, "created_at": m.created_at.isoformat()}
            for m in messages
        ],
    }


@admin_router.post("/chat/sessions/{session_id}/reply")
def admin_reply(session_id: str, req: AdminReplyRequest, db: Session = Depends(get_db)):
    """Support team posts a reply — this shows up as an 'admin' message in the
    user's chat next time they fetch history (or via polling in ChatWidget.jsx)."""
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")

    db.add(ChatMessage(session_id=session_id, role="admin", content=req.message, source="admin"))
    session.status = "answered"   # still with support; follow-ups go to support until the chat is closed
    db.add(session)

    # Bell notification for the end user (only if the chat belongs to a logged-in user)
    if session.user_id and str(session.user_id).isdigit():
        db.add(Notification(
            user_id=int(session.user_id),
            title="Support team replied",
            message="Our support team has replied to your chat. Open the support chat to see it.",
            type="success",
        ))
    db.commit()

    return {"ok": True, "session_id": session_id, "status": "answered"}


@admin_router.post("/chat/sessions/{session_id}/close")
def close_session(session_id: str, db: Session = Depends(get_db)):
    """Support team closes the chat — the bot takes over again for this user."""
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="session not found")

    db.add(ChatMessage(
        session_id=session_id,
        role="assistant",
        content="This chat has been closed by our support team. I'm here if you need anything else!",
        source="rule",
    ))
    session.status = "resolved"
    db.add(session)
    db.commit()

    return {"ok": True, "session_id": session_id, "status": "resolved"}
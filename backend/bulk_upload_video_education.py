"""
Bulk upload Education & Edtech VIDEO templates to Cloudinary, into:
    adnexus/templates_videos/education-edtech/

Only uploads the first 4 videos (sorted), skips any extra.
"""
import os
import glob
import re
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

FOLDER = "adnexus/templates_videos/education-edtech/"
LOCAL_DIR = "templates_videos_educations"
MAX_FILES = 4   # <-- only upload first 4

def clean_public_id(filename):
    name = os.path.splitext(filename)[0]
    name = name.replace("(", "").replace(")", "")
    name = re.sub(r"\s+", "-", name.strip())
    return name

def upload_all():
    files = sorted(glob.glob(os.path.join(LOCAL_DIR, "*.mp4")))[:MAX_FILES]

    if not files:
        print(f"No video files found in ./{LOCAL_DIR}/ — check the folder.")
        return

    results = []
    for path in files:
        filename = os.path.basename(path)
        public_id = clean_public_id(filename)
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"Uploading {filename} ({size_mb:.1f} MB) ...")
        result = cloudinary.uploader.upload_large(
            path,
            folder=FOLDER,
            public_id=public_id,
            resource_type="video",
            overwrite=True,
            chunk_size=6000000,
        )
        print(f"  -> {result['secure_url']}")
        results.append((filename, result["secure_url"]))

    print(f"\nDone. Uploaded {len(results)} files.")
    return results

if __name__ == "__main__":
    upload_all()
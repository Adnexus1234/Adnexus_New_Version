"""
Bulk upload Healthcare & Pharma VIDEO templates to Cloudinary, into:
    adnexus/templates_videos/healthcare-pharma/

Usage:
    1. Make sure ./templates_videos_healthcare/ has your videos (MP4)
    2. Make sure your .env has CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
    3. python bulk_upload_video_healthcare.py

Run this from the backend folder.
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

FOLDER = "adnexus/templates_videos/healthcare-pharma/"
LOCAL_DIR = "templates_videos_healthcare"

def clean_public_id(filename):
    name = os.path.splitext(filename)[0]
    name = name.replace("(", "").replace(")", "")
    name = re.sub(r"\s+", "-", name.strip())
    return name

def upload_all():
    files = sorted(glob.glob(os.path.join(LOCAL_DIR, "*.mp4")))

    if not files:
        print(f"No video files found in ./{LOCAL_DIR}/ — check the folder.")
        return

    results = []
    for path in files:
        filename = os.path.basename(path)
        public_id = clean_public_id(filename)
        print(f"Uploading {filename} ...")
        result = cloudinary.uploader.upload(
            path,
            folder=FOLDER,
            public_id=public_id,
            resource_type="video",
            overwrite=True,
        )
        print(f"  -> {result['secure_url']}")
        results.append((filename, result["secure_url"]))

    print(f"\nDone. Uploaded {len(results)} files.")
    return results

if __name__ == "__main__":
    upload_all()
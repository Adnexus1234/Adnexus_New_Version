"""
Bulk upload Designs-feature background templates (NO text baked in —
text is overlaid by the frontend) to Cloudinary, into:
    adnexus/design-templates/<industry>/

Usage:
    1. Put images in ./design_templates_financial_services/ (e.g. template1.png)
    2. .env already has CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
    3. python bulk_upload_design_templates.py
"""
import os
import glob
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

INDUSTRY = "financial-services"
CLOUDINARY_FOLDER = f"adnexus/design-templates/{INDUSTRY}"
LOCAL_DIR = "design_templates_financial_services"

def upload_all():
    exts = ("*.png", "*.jpg", "*.jpeg")
    files = []
    for ext in exts:
        files.extend(glob.glob(os.path.join(LOCAL_DIR, ext)))
    files = sorted(set(files))

    if not files:
        print(f"No image files found in ./{LOCAL_DIR}/ — check the folder.")
        return

    results = []
    for path in files:
        filename = os.path.basename(path)
        public_id = os.path.splitext(filename)[0]
        print(f"Uploading {filename} ...")
        result = cloudinary.uploader.upload(
            path,
            folder=CLOUDINARY_FOLDER,
            public_id=public_id,
            resource_type="image",
            overwrite=True,
        )
        print(f"  -> {result['secure_url']}")
        results.append((filename, result["secure_url"]))

    print(f"\nDone. Uploaded {len(results)} files.")
    print("\n--- Copy these for your SQL INSERT ---")
    for filename, url in results:
        print(f"{filename}: {url}")

    return results

if __name__ == "__main__":
    upload_all()
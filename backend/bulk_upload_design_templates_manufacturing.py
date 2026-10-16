"""
Bulk upload Manufacturing design templates to Cloudinary:
    adnexus/design-templates/manufacturing/
Run from the backend/ folder: python bulk_upload_design_templates_manufacturing.py
"""
import os
import re
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

INDUSTRY = "manufacturing"
CLOUDINARY_FOLDER = f"adnexus/design-templates/{INDUSTRY}"
LOCAL_DIR = "design_templates_manufacturing"


def natural_key(path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", os.path.basename(path))]


def upload_all():
    files = []
    for ext in ("*.png", "*.jpg", "*.jpeg"):
        files.extend(glob.glob(os.path.join(LOCAL_DIR, ext)))
    files = sorted(set(files), key=natural_key)

    if not files:
        print(f"No image files found in ./{LOCAL_DIR}/ — check the folder.")
        return

    results = []
    for i, path in enumerate(files, start=1):
        filename = os.path.basename(path)
        public_id = f"template{i}"
        print(f"Uploading {filename} as {public_id} ...")
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
"""
Bulk upload Healthcare & Pharma design templates to Cloudinary:
    adnexus/design-templates/healthcare-pharma/
Run from the backend/ folder: python bulk_upload_design_templates_pharma.py

Note: agar same naam ki .png aur .jpg dono hon (jaise "pharma (1)"),
to .png ko prefer karta hai aur .jpg skip karta hai.
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

INDUSTRY = "healthcare-pharma"
CLOUDINARY_FOLDER = f"adnexus/design-templates/{INDUSTRY}"
LOCAL_DIR = "design_templates_pharma"

# Jab same naam ki multiple files hon, to is order mein prefer karo
EXT_PRIORITY = {".png": 0, ".jpg": 1, ".jpeg": 1}


def natural_key(path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", os.path.basename(path))]


def collect_files():
    files = []
    for ext in ("*.png", "*.jpg", "*.jpeg"):
        files.extend(glob.glob(os.path.join(LOCAL_DIR, ext)))

    # Same base name (extension ke bina) wali files mein se best ek rakho
    best = {}
    for path in files:
        base, ext = os.path.splitext(os.path.basename(path))
        key = base.lower()
        if key not in best:
            best[key] = path
        else:
            current_ext = os.path.splitext(best[key])[1].lower()
            if EXT_PRIORITY[ext.lower()] < EXT_PRIORITY[current_ext]:
                print(f"Skipping duplicate: {os.path.basename(best[key])} (using {os.path.basename(path)})")
                best[key] = path
            else:
                print(f"Skipping duplicate: {os.path.basename(path)} (using {os.path.basename(best[key])})")

    return sorted(best.values(), key=natural_key)


def upload_all():
    files = collect_files()

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
#!/usr/bin/env python3
"""Sync MiniApps to Cloudflare R2 CDN."""

import boto3
import os
from pathlib import Path

R2_ENDPOINT = "https://bf0d7e814f69945157f30505e9fba9fe.r2.cloudflarestorage.com"
BUCKET_NAME = "miniapps"
AWS_ACCESS_KEY_ID = "cc77eee149d8f679bc0f751ca346a236"
AWS_SECRET_ACCESS_KEY = (
    "***REMOVED***"
)
APPS_DIR = Path("/home/neo/git/miniapps-repo/apps")


def sync_app_to_r2(app_path: Path):
    """Sync a single miniapp to R2."""
    app_name = app_path.name
    print(f"Syncing {app_name}...")

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name="auto",
    )

    # Files to upload: index.html, public/logo.jpg, public/banner.jpg
    files_to_upload = [
        ("index.html", "index.html"),
        ("public/logo.jpg", "logo.jpg"),
        ("public/banner.jpg", "banner.jpg"),
    ]

    for local_path, s3_key in files_to_upload:
        full_local = app_path / local_path
        full_s3_key = f"{app_name}/{s3_key}"

        if full_local.exists():
            try:
                s3.upload_file(
                    str(full_local),
                    BUCKET_NAME,
                    full_s3_key,
                    ExtraArgs={
                        "ContentType": "text/html"
                        if s3_key == "index.html"
                        else "image/png",
                        "CacheControl": "public, max-age=31536000, immutable",
                    },
                )
                print(f"  ✓ {full_s3_key}")
            except Exception as e:
                print(f"  ✗ Failed {full_s3_key}: {e}")
        else:
            print(f"  ✗ Missing {local_path}")


def main():
    print(f"Syncing MiniApps from {APPS_DIR} to R2...")
    print(f"Bucket: {BUCKET_NAME}")
    print("-" * 50)

    for app_path in sorted(APPS_DIR.iterdir()):
        if app_path.is_dir():
            sync_app_to_r2(app_path)

    print("-" * 50)
    print("Done!")


if __name__ == "__main__":
    main()

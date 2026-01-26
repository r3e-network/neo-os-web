#!/usr/bin/env python3
"""Sync a single MiniApp to Cloudflare R2 CDN."""

import boto3
import sys

R2_ENDPOINT = "https://bf0d7e814f69945157f30505e9fba9fe.r2.cloudflarestorage.com"
BUCKET_NAME = "miniapps"
AWS_ACCESS_KEY_ID = "cc77eee149d8f679bc0f751ca346a236"
AWS_SECRET_ACCESS_KEY = (
    "***REMOVED***"
)


def sync_single_app(app_name: str):
    """Sync a single miniapp to R2."""
    print(f"Syncing {app_name}...")

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name="auto",
    )

    app_path = f"/home/neo/git/miniapps-repo/apps/{app_name}"

    # Files to upload
    files = [
        ("index.html", "index.html", "text/html"),
        ("public/logo.png", "logo.png", "image/png"),
        ("public/banner.png", "banner.png", "image/png"),
    ]

    for local_name, s3_key, content_type in files:
        full_local = f"{app_path}/{local_name}"
        full_s3_key = f"{app_name}/{s3_key}"

        try:
            with open(full_local, "rb") as f:
                s3.put_object(
                    Body=f,
                    Bucket=BUCKET_NAME,
                    Key=full_s3_key,
                    ContentType=content_type,
                    CacheControl="public, max-age=31536000, immutable",
                )
            print(f"  ✓ {full_s3_key}")
        except FileNotFoundError:
            print(f"  ✗ Missing {full_local}")
        except Exception as e:
            print(f"  ✗ Failed {full_s3_key}: {e}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 sync_single_app.py <app-name>")
        sys.exit(1)

    sync_single_app(sys.argv[1])

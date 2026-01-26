#!/usr/bin/env python3
"""Sync all MiniApps to Cloudflare R2 CDN with correct prefix."""

import boto3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

R2_ENDPOINT = "https://bf0d7e814f69945157f30505e9fba9fe.r2.cloudflarestorage.com"
BUCKET_NAME = "miniapps"
AWS_ACCESS_KEY_ID = "cc77eee149d8f679bc0f751ca346a236"
AWS_SECRET_ACCESS_KEY = (
    "***REMOVED***"
)
APPS_DIR = Path("/home/neo/git/miniapps/apps")


def sync_app(app_name: str):
    """Sync a single miniapp to R2 under miniapps/ prefix."""
    app_path = APPS_DIR / app_name

    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name="auto",
    )

    files = [
        ("index.html", "miniapps/index.html", "text/html"),
        ("public/logo.png", "miniapps/logo.png", "image/png"),
        ("public/banner.png", "miniapps/banner.png", "image/png"),
    ]

    results = []
    for local_name, s3_key, content_type in files:
        full_local = app_path / local_name
        full_s3_key = f"miniapps/{app_name}/{s3_key.split('/')[-1]}"

        try:
            with open(full_local, "rb") as f:
                s3.put_object(
                    Body=f,
                    Bucket=BUCKET_NAME,
                    Key=full_s3_key,
                    ContentType=content_type,
                    CacheControl="public, max-age=31536000, immutable",
                )
            results.append((s3_key, "OK"))
        except FileNotFoundError:
            results.append((s3_key, "MISSING"))
        except Exception as e:
            results.append((s3_key, f"ERROR: {e}"))

    return app_name, results


def main():
    print(f"Syncing all MiniApps to R2 CDN...")
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Prefix: miniapps/")
    print("-" * 60)

    apps = sorted([d.name for d in APPS_DIR.iterdir() if d.is_dir()])
    print(f"Found {len(apps)} apps")

    success = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(sync_app, app): app for app in apps}

        for future in as_completed(futures):
            app_name, results = future.result()
            has_error = any("ERROR" in r[1] or "MISSING" in r[1] for r in results)

            status = "✓" if not has_error else "✗"
            print(f"{status} {app_name}")
            for key, result in results:
                if "ERROR" in result or "MISSING" in result:
                    print(f"    {result} ({key})")

            if not has_error:
                success += 1
            else:
                failed += 1

    print("-" * 60)
    print(f"Complete: {success} synced, {failed} failed")


if __name__ == "__main__":
    main()

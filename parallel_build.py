
import os
import subprocess
import concurrent.futures

apps_dir = "/home/neo/git/service_layer/miniapps-uniapp/apps"
apps = [d for d in os.listdir(apps_dir) if os.path.isdir(os.path.join(apps_dir, d))]

def build_app(app):
    app_path = os.path.join(apps_dir, app)
    # Check if package.json exists
    if not os.path.exists(os.path.join(app_path, "package.json")):
        return f"SKIP {app}"
        
    # Run build
    # use pnpm build:h5
    try:
        # We assume pnpm is in path
        cmd = ["pnpm", "build:h5"]
        # If build:h5 doesn't exist, pnpm might error, but we can try just 'build' or check package.json
        # Just run it
        subprocess.run(cmd, cwd=app_path, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        return f"OK {app}"
    except subprocess.CalledProcessError as e:
        return f"FAIL {app}: {e.stderr.decode('utf-8')[:100]}"
    except Exception as e:
        return f"ERR {app}: {str(e)}"

print(f"Building {len(apps)} apps in parallel (max 8 workers)...")

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(build_app, apps))

success = 0
failed = 0
for r in results:
    print(r)
    if r.startswith("OK"):
        success += 1
    else:
        failed += 1

print(f"Build complete. Success: {success}, Failed: {failed}")

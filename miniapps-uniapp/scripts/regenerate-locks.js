const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const appsDir = path.join(__dirname, "../apps");
const apps = fs.readdirSync(appsDir);

let updated = 0;
let failed = 0;

for (const app of apps) {
  const appPath = path.join(appsDir, app);
  const pkgPath = path.join(appPath, "package.json");
  const lockPath = path.join(appPath, "package-lock.json");

  if (fs.existsSync(pkgPath)) {
    try {
      // Remove old lock file
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
      // Generate new lock file
      execSync("npm install --package-lock-only", {
        cwd: appPath,
        stdio: "pipe",
      });
      console.log("✅", app);
      updated++;
    } catch (e) {
      console.log("❌", app, e.message.split("\n")[0]);
      failed++;
    }
  }
}

console.log(`\nTotal: ${updated} updated, ${failed} failed`);

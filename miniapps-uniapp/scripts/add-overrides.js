const fs = require("fs");
const path = require("path");

const appsDir = path.join(__dirname, "../apps");
const apps = fs.readdirSync(appsDir);

const overrides = {
  "@intlify/core-base": ">=9.14.5",
  "@intlify/message-resolver": ">=9.14.5",
  "@intlify/shared": ">=9.14.5",
};

let updated = 0;
for (const app of apps) {
  const pkgPath = path.join(appsDir, app, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.overrides = overrides;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("Updated:", app);
    updated++;
  }
}
console.log(`\nTotal updated: ${updated} apps`);

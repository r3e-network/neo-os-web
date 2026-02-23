const fs = require('fs');

const f = 'cmd/deploy-miniapps-live/main.go';
if (fs.existsSync(f)) {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/var miniApps = \[\]string\{\n.*?\n\}/s, `var miniApps = []string{
        "MiniAppTemplates",
}`);
  fs.writeFileSync(f, content);
}

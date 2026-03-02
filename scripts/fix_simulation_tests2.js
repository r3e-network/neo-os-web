const fs = require('fs');

const f = 'services/simulation/marble/miniapp_simulator_test.go';
if (fs.existsSync(f)) {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/func TestAllMiniApps\(t \*testing\.T\) \{\n.*?\n\}\n/s, `func TestAllMiniApps(t *testing.T) {
        apps := AllMiniApps()
        assert.Len(t, apps, 4)
}
`);
  fs.writeFileSync(f, content);
}

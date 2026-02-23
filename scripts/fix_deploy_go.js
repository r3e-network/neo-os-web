const fs = require('fs');

const validApps = [
  "MiniAppCandidateVote",
  "MiniAppCoinFlip",
  "MiniAppDevTipping",
  "MiniAppDiceGame",
  "MiniAppGasCircle",
  "MiniAppLottery",
  "MiniAppPredictionMarket",
  "MiniAppRedEnvelope",
  "MiniAppSecretVote",
  "MiniAppTemplates"
];

const appsStr = validApps.map(a => `        "${a}",`).join('\n');

for (const f of ['cmd/deploy-miniapps/main.go', 'cmd/deploy-new-miniapps/main.go']) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/var newMiniApps = \[\]string\{\n.*?\n\}/s, `var newMiniApps = []string{\n${appsStr}\n}`);
    fs.writeFileSync(f, content);
  }
}

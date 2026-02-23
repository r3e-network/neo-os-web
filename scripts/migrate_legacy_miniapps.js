const fs = require('fs');
const path = require('path');

// Target directory for generic templates
const TARGET_DIR = path.join(__dirname, '../platform/host-app/public/miniapp-definitions/migrated');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// A generic function to generate a JSON config based on type
function generateConfig(appId, name, type, operations) {
  let layout = "default";
  let contractTemplateId = "base-v1";

  if (type === "prediction") {
    layout = "prediction";
    contractTemplateId = "prediction-binary";
  } else if (type === "lottery") {
    layout = "lottery";
    contractTemplateId = "lottery-v1";
  } else if (type === "governance") {
    layout = "governance";
    contractTemplateId = "governance-v1";
  }

  const json = {
    "$schema": "../miniapp-config.schema.json",
    "app_id": appId,
    "name": name,
    "template_type": type,
    "category": type === "governance" ? "governance" : type === "prediction" ? "defi" : "gaming",
    "entry_url": `mf://builtin?app=${appId}`,
    "contract": {
      "template_id": contractTemplateId,
      "init_params": {}
    },
    "frontend_spec": {
      "layout": layout,
      "hero": {
        "eyebrow": name.toUpperCase(),
        "disclaimer": "Legacy app migrated to generic template."
      },
      "tabs": [
        {
          "id": "overview",
          "label": "Overview",
          "type": "content",
          "blocks": [
            {
              "type": "markdown",
              "content": `## ${name}\n\nMigrated automatically.`
            }
          ]
        }
      ],
      "operation_panel": {
        "title": "Interact",
        "cta_label": "Submit Tx"
      }
    },
    "operations": operations
  };

  fs.writeFileSync(path.join(TARGET_DIR, `${appId}.json`), JSON.stringify(json, null, 2));
}

// Map of legacy apps to migrate
const migrations = [
  { id: 'miniapp-candidate-vote', name: 'Candidate Vote', type: 'governance', ops: [{ name: 'Vote', method: 'vote', button_style: 'primary', params: [{ name: 'candidate', type: 'string', required: true }] }] },
  { id: 'miniapp-prediction-market', name: 'Prediction Market', type: 'prediction', ops: [{ name: 'Buy YES', method: 'buyYes', button_style: 'primary', params: [{ name: 'amount', type: 'amount', required: true }] }, { name: 'Buy NO', method: 'buyNo', button_style: 'danger', params: [{ name: 'amount', type: 'amount', required: true }] }] },
  { id: 'miniapp-lottery', name: 'Lottery Game', type: 'lottery', ops: [{ name: 'Buy Ticket', method: 'buyTicket', button_style: 'primary', params: [{ name: 'tickets', type: 'integer', required: true }] }] },
  { id: 'miniapp-secret-vote', name: 'Secret Vote', type: 'governance', ops: [{ name: 'Submit ZK Vote', method: 'submitZkVote', button_style: 'primary', params: [{ name: 'proof', type: 'string', required: true }] }] }
];

migrations.forEach(m => {
  generateConfig(m.id, m.name, m.type, m.ops);
  console.log(`Migrated ${m.name} -> JSON definition`);
});

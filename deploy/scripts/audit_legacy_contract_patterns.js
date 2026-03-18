#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const EXCLUDED_DIRS = new Set([
  "MiniApp.DevPack",
  "MiniAppBase",
]);

function listMiniAppContractDirs() {
  return fs.readdirSync(CONTRACTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("MiniApp"))
    .filter((name) => !EXCLUDED_DIRS.has(name))
    .sort();
}

function listSourceFiles(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith(".cs"))
    .filter((name) => !name.endsWith(".g.cs"))
    .map((name) => path.join(dirPath, name));
}

function findMatches(source, regex) {
  const matches = [];
  let match;
  const re = new RegExp(regex.source, regex.flags);
  while ((match = re.exec(source)) !== null) {
    matches.push(match[0]);
  }
  return matches;
}

function main() {
  const receiptUsage = [];
  const receiptParams = [];
  const directOracleCalls = [];
  const missingPaymentReceiver = [];

  for (const dirName of listMiniAppContractDirs()) {
    const dirPath = path.join(CONTRACTS_DIR, dirName);
    const files = listSourceFiles(dirPath);
    let hasDirectCreditConsumer = false;
    let hasPaymentReceiver = false;

    for (const filePath of files) {
      const relativePath = path.relative(ROOT, filePath);
      const source = fs.readFileSync(filePath, "utf8");

      if (source.includes("ValidatePaymentReceipt(")) {
        receiptUsage.push(relativePath);
      }

      if (/public\s+static[\s\S]*?\breceiptId\b/.test(source)) {
        receiptParams.push(relativePath);
      }

      if (/ConsumeDirect(?:Gas|Asset)Credit\(/.test(source)) {
        hasDirectCreditConsumer = true;
      }

      if (source.includes("OnNEP17Payment(")) {
        hasPaymentReceiver = true;
      }

      const oracleMatches = findMatches(
        source,
        /Contract\.Call\s*\([\s\S]*?"request(?:FromCallback)?"/g
      );
      if (oracleMatches.length > 0) {
        directOracleCalls.push(relativePath);
      }
    }

    if (hasDirectCreditConsumer && !hasPaymentReceiver) {
      missingPaymentReceiver.push(dirName);
    }
  }

  const report = {
    checked_dirs: listMiniAppContractDirs().length,
    excluded_dirs: Array.from(EXCLUDED_DIRS).sort(),
    receipt_usage: receiptUsage,
    receipt_params: receiptParams,
    direct_oracle_calls: directOracleCalls,
    missing_payment_receiver: missingPaymentReceiver,
  };

  console.log(JSON.stringify(report, null, 2));

  if (
    receiptUsage.length > 0 ||
    receiptParams.length > 0 ||
    directOracleCalls.length > 0 ||
    missingPaymentReceiver.length > 0
  ) {
    process.exit(1);
  }
}

main();

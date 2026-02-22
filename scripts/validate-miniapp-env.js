#!/usr/bin/env node
/* eslint-disable no-console */

try {
  // Optional: supports local .env when dotenv is installed.
  require("dotenv").config();
} catch {
  // noop
}

function parseArgs(argv) {
  const out = {
    target: "all",
    stage: "prod",
    json: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--target=")) {
      const value = arg.slice("--target=".length).trim().toLowerCase();
      if (["host", "admin", "all"].includes(value)) out.target = value;
    } else if (arg.startsWith("--stage=")) {
      const value = arg.slice("--stage=".length).trim().toLowerCase();
      if (["dev", "staging", "prod"].includes(value)) out.stage = value;
    } else if (arg === "--json") {
      out.json = true;
    }
  }

  return out;
}

function asTrimmedEnv(name) {
  return String(process.env[name] || "").trim();
}

function isTruthy(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isUrl(value) {
  try {
    if (!value) return false;
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.host);
  } catch {
    return false;
  }
}

function checkRequired(envName, context, issues) {
  const value = asTrimmedEnv(envName);
  if (!value) {
    issues.push({
      level: "error",
      env: envName,
      context,
      message: `${envName} is required`,
    });
  }
  return value;
}

function checkUrl(envName, context, issues) {
  const value = asTrimmedEnv(envName);
  if (!value) {
    issues.push({
      level: "error",
      env: envName,
      context,
      message: `${envName} is required`,
    });
    return "";
  }
  if (!isUrl(value)) {
    issues.push({
      level: "error",
      env: envName,
      context,
      message: `${envName} must be a valid URL`,
    });
  }
  return value;
}

function checkMinLength(envName, context, issues, minLength) {
  const value = asTrimmedEnv(envName);
  if (!value) {
    issues.push({
      level: "error",
      env: envName,
      context,
      message: `${envName} is required`,
    });
    return "";
  }
  if (value.length < minLength) {
    issues.push({
      level: "warning",
      env: envName,
      context,
      message: `${envName} should be at least ${minLength} characters`,
    });
  }
  return value;
}

function validateHost(stage, issues) {
  const context = "host";

  checkUrl("NEXT_PUBLIC_SUPABASE_URL", context, issues);
  checkRequired("SUPABASE_SERVICE_ROLE_KEY", context, issues);
  checkMinLength("MINIAPP_ADMIN_API_KEY", context, issues, stage === "prod" ? 24 : 12);

  const approvalRequiredRaw = asTrimmedEnv("MINIAPP_PUBLISH_APPROVAL_REQUIRED");
  if (!approvalRequiredRaw) {
    issues.push({
      level: stage === "prod" ? "error" : "warning",
      env: "MINIAPP_PUBLISH_APPROVAL_REQUIRED",
      context,
      message: "MINIAPP_PUBLISH_APPROVAL_REQUIRED should be explicitly set",
    });
  }
  const approvalRequired = isTruthy(approvalRequiredRaw);

  if (stage === "prod" && !approvalRequired) {
    issues.push({
      level: "warning",
      env: "MINIAPP_PUBLISH_APPROVAL_REQUIRED",
      context,
      message: "Approval gate is disabled in prod",
    });
  }

  if (approvalRequired) {
    const reviewers = asTrimmedEnv("MINIAPP_PUBLISH_REVIEWERS");
    const admins = asTrimmedEnv("MINIAPP_ADMIN_WALLETS");
    if (!reviewers && !admins) {
      issues.push({
        level: stage === "prod" ? "error" : "warning",
        env: "MINIAPP_PUBLISH_REVIEWERS",
        context,
        message: "Set MINIAPP_PUBLISH_REVIEWERS (or MINIAPP_ADMIN_WALLETS fallback) when approval is enabled",
      });
    }
  }

  const sla = Number.parseInt(asTrimmedEnv("MINIAPP_PUBLISH_APPROVAL_SLA_MINUTES"), 10);
  if (!Number.isFinite(sla) || sla <= 0) {
    issues.push({
      level: "warning",
      env: "MINIAPP_PUBLISH_APPROVAL_SLA_MINUTES",
      context,
      message: "Using default SLA minutes (60); set explicit value for clarity",
    });
  }

  const escalation = Number.parseInt(asTrimmedEnv("MINIAPP_PUBLISH_APPROVAL_ESCALATION_MINUTES"), 10);
  if (!Number.isFinite(escalation) || escalation <= 0) {
    issues.push({
      level: "warning",
      env: "MINIAPP_PUBLISH_APPROVAL_ESCALATION_MINUTES",
      context,
      message: "Using default escalation minutes (180); set explicit value for clarity",
    });
  }

  const webhook = asTrimmedEnv("MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL");
  if (!webhook) {
    issues.push({
      level: stage === "prod" ? "warning" : "info",
      env: "MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL",
      context,
      message: "Reminder webhook is not configured",
    });
  } else if (!isUrl(webhook)) {
    issues.push({
      level: "error",
      env: "MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL",
      context,
      message: "Reminder webhook URL is invalid",
    });
  }

  checkMinLength("CRON_SECRET", context, issues, stage === "prod" ? 24 : 12);
  checkUrl("HOST_APP_BASE_URL", context, issues);
}

function validateAdmin(stage, issues) {
  const context = "admin";

  checkMinLength("ADMIN_CONSOLE_API_KEY", context, issues, stage === "prod" ? 24 : 12);
  checkUrl("MINIAPP_HOST_APP_BASE_URL", context, issues);

  const supabaseUrl = asTrimmedEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) {
    issues.push({
      level: "warning",
      env: "NEXT_PUBLIC_SUPABASE_URL",
      context,
      message: "NEXT_PUBLIC_SUPABASE_URL is not set (some admin features may degrade)",
    });
  } else if (!isUrl(supabaseUrl)) {
    issues.push({
      level: "error",
      env: "NEXT_PUBLIC_SUPABASE_URL",
      context,
      message: "NEXT_PUBLIC_SUPABASE_URL must be valid URL",
    });
  }
}

function levelWeight(level) {
  if (level === "error") return 3;
  if (level === "warning") return 2;
  return 1;
}

function printHuman(result) {
  console.log(`MiniApp Env Validation (target=${result.target}, stage=${result.stage})`);
  console.log(`Status: ${result.ok ? "OK" : "FAILED"}`);
  console.log(`Errors: ${result.counts.error}, Warnings: ${result.counts.warning}, Info: ${result.counts.info}`);

  if (!result.issues.length) return;

  console.log("\nIssues:");
  const sorted = [...result.issues].sort((a, b) => levelWeight(b.level) - levelWeight(a.level));
  for (const issue of sorted) {
    console.log(`- [${issue.level.toUpperCase()}] [${issue.context}] ${issue.env}: ${issue.message}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const issues = [];

  if (args.target === "host" || args.target === "all") {
    validateHost(args.stage, issues);
  }
  if (args.target === "admin" || args.target === "all") {
    validateAdmin(args.stage, issues);
  }

  const counts = {
    error: issues.filter((x) => x.level === "error").length,
    warning: issues.filter((x) => x.level === "warning").length,
    info: issues.filter((x) => x.level === "info").length,
  };

  const result = {
    ok: counts.error === 0,
    target: args.target,
    stage: args.stage,
    counts,
    issues,
    generated_at: new Date().toISOString(),
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  if (!result.ok) {
    process.exitCode = 2;
  }
}

main();

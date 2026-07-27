#!/usr/bin/env node
/**
 * Verify that every published app launches the way OneGate opens it.
 *
 * OneGate opens an app at the platform's /play/<slug>. This walks the published
 * catalogues and, for each app, checks the whole chain that launch depends on:
 *
 *   1. /play/<slug> answers 200
 *   2. it frames the app's versioned CDN entry, not a platform path
 *   3. that entry actually exists on the CDN
 *   4. the page carries no platform chrome - OneGate must show the app alone
 *   5. it is embeddable - frame-ancestors allows OneGate, and no X-Frame-Options
 *      DENY contradicts it
 *
 * A failure names the app and which link broke.
 *
 *   node scripts/verify-onegate-launch.mjs [--host http://localhost:3100]
 */
const args = process.argv.slice(2);
const hostFlag = args.indexOf("--host");
const HOST = (hostFlag >= 0 ? args[hostFlag + 1] : process.env.PLATFORM_HOST || "http://localhost:3100").replace(/\/+$/, "");
const CDN = (process.env.MINIAPP_CDN_BASE_URL || "https://meshmini.app").replace(/\/+$/, "");
const ONEGATE_ORIGIN = "https://onegate.space";

// Markers that would mean the launcher shell leaked into the OneGate surface.
const CHROME_MARKERS = [
  'data-testid="site-header"',
  'data-testid="site-footer"',
  'data-testid="platform-nav"',
];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function head(url) {
  // Cloudflare rejects some non-browser HEADs; a ranged GET is equivalent here
  // and avoids a false negative on an object that is actually present.
  const res = await fetch(url, { headers: { range: "bytes=0-0" } });
  return res.status;
}

async function checkApp(app) {
  const slug = app.slug;
  const problems = [];

  const playUrl = `${HOST}/play/${slug}`;
  let res;
  try {
    res = await fetch(playUrl, { headers: { origin: ONEGATE_ORIGIN } });
  } catch (error) {
    return [`${slug}: /play unreachable - ${error.message}`];
  }

  if (res.status !== 200) problems.push(`${slug}: /play -> HTTP ${res.status}`);

  const html = await res.text();

  // 2. The framed entry must be the app's versioned CDN bundle.
  const framed = html.match(/src="(https:\/\/[^"]*\/index\.html[^"]*)"/);
  if (!framed) {
    problems.push(`${slug}: /play frames no CDN entry`);
  } else {
    const entry = framed[1].replace(/&amp;/g, "&");
    if (!entry.startsWith(`${CDN}/`)) {
      problems.push(`${slug}: framed entry is not on the CDN - ${entry}`);
    }
    if (!entry.includes(`/${app.version}/`)) {
      problems.push(`${slug}: framed entry is not version ${app.version} - ${entry}`);
    }
    const status = await head(entry.split("?")[0]);
    if (status !== 200 && status !== 206) {
      problems.push(`${slug}: framed entry ${entry.split("?")[0]} -> HTTP ${status}`);
    }
  }

  // 4. No platform chrome on the OneGate surface.
  for (const marker of CHROME_MARKERS) {
    if (html.includes(marker)) problems.push(`${slug}: /play leaks platform chrome (${marker})`);
  }

  // 5. Embeddable by OneGate.
  const csp = res.headers.get("content-security-policy") || "";
  const frameAncestors = csp.match(/frame-ancestors ([^;]+)/);
  if (!frameAncestors) {
    problems.push(`${slug}: /play sends no frame-ancestors`);
  } else if (!frameAncestors[1].includes("onegate.space")) {
    problems.push(`${slug}: /play does not allow OneGate - frame-ancestors ${frameAncestors[1].trim()}`);
  }
  const xfo = res.headers.get("x-frame-options");
  if (xfo && /deny|sameorigin/i.test(xfo)) {
    problems.push(`${slug}: /play sends X-Frame-Options ${xfo}, which overrides frame-ancestors`);
  }

  return problems;
}

async function main() {
  const catalogues = await Promise.all([
    getJson(`${CDN}/catalog/minigames.json`),
    getJson(`${CDN}/catalog/miniapps.json`),
  ]);
  const apps = catalogues.flatMap((c) => c.apps);
  if (apps.length === 0) throw new Error("both catalogues are empty - refusing to report a pass");

  console.log(`checking ${apps.length} apps against ${HOST}\n`);

  const failures = [];
  let done = 0;
  // Serial: this drives a single dev/production server, and hammering it in
  // parallel produces timeouts that look like app failures.
  for (const app of apps) {
    const problems = await checkApp(app);
    done += 1;
    if (problems.length > 0) {
      failures.push(...problems);
      console.log(`  ✗ ${app.slug}`);
      for (const problem of problems) console.log(`      ${problem}`);
    } else if (done % 10 === 0) {
      console.log(`  ${done}/${apps.length} ok`);
    }
  }

  console.log(`\n${apps.length - new Set(failures.map((f) => f.split(":")[0])).size}/${apps.length} apps launch cleanly`);
  if (failures.length > 0) {
    console.log(`${failures.length} problems across ${new Set(failures.map((f) => f.split(":")[0])).size} apps`);
    process.exit(1);
  }
  console.log("every published app launches the way OneGate opens it");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

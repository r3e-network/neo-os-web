/**
 * Fuzz test runner — executes fuzz campaigns with configurable iteration count,
 * timeout, and reporting. Designed for continuous fuzzing via cron or CI.
 */

const DEFAULT_ITERATIONS = parseInt(process.env.FUZZ_ITERATIONS || "100", 10);
const DEFAULT_TIMEOUT_MS = parseInt(process.env.FUZZ_TIMEOUT_MS || "300000", 10);

const TRANSIENT_PATTERNS = [
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND",
  "socket hang up", "network timeout", "fetch failed",
  "Request failed", "502", "503", "504",
];

function isTransientNetworkError(err) {
  const msg = String(err?.message || "");
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
}

export class FuzzRunner {
  constructor(name, { iterations = DEFAULT_ITERATIONS, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.name = name;
    this.iterations = iterations;
    this.timeoutMs = timeoutMs;
    this.results = { pass: 0, fail: 0, error: 0, skip: 0, findings: [] };
    this.startTime = null;
  }

  /** Register a finding (unexpected behavior that's not a crash) */
  finding(description, details = {}) {
    this.results.findings.push({
      description,
      iteration: this._currentIteration,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  /** Run a fuzz campaign */
  async run(fn) {
    this.startTime = Date.now();
    const deadline = this.startTime + this.timeoutMs;
    console.log(`[fuzz] ${this.name}: starting ${this.iterations} iterations (timeout ${this.timeoutMs}ms)`);

    for (let i = 0; i < this.iterations && Date.now() < deadline; i++) {
      this._currentIteration = i;
      try {
        const result = await fn(i);
        if (result === "skip") {
          this.results.skip++;
        } else {
          this.results.pass++;
        }
      } catch (err) {
        if (err._expected) {
          // Expected error (e.g., contract reverted on invalid input — that's correct behavior)
          this.results.pass++;
        } else if (isTransientNetworkError(err)) {
          // Transient RPC/network error — not a contract bug, don't count as finding
          this.results.skip++;
        } else {
          this.results.error++;
          this.results.findings.push({
            description: `Unexpected error: ${err.message}`,
            iteration: i,
            timestamp: new Date().toISOString(),
            stack: err.stack?.split("\n").slice(0, 3).join("\n"),
          });
        }
      }

      if (i > 0 && i % 50 === 0) {
        console.log(`[fuzz] ${this.name}: ${i}/${this.iterations} (${this.results.pass} pass, ${this.results.error} error)`);
      }
    }

    const elapsed = Date.now() - this.startTime;
    const total = this.results.pass + this.results.fail + this.results.error + this.results.skip;
    console.log(`[fuzz] ${this.name}: completed ${total} iterations in ${elapsed}ms`);
    console.log(`[fuzz]   pass=${this.results.pass} fail=${this.results.fail} error=${this.results.error} skip=${this.results.skip} findings=${this.results.findings.length}`);

    if (this.results.findings.length > 0) {
      console.log(`[fuzz] FINDINGS:`);
      for (const f of this.results.findings) {
        console.log(`  [${f.iteration}] ${f.description}`);
      }
    }

    return this.results;
  }
}

/** Mark an error as expected (contract correctly rejected bad input) */
export function expectedError(err) {
  err._expected = true;
  return err;
}

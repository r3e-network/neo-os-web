import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The host<->iframe bridges used to declare their wire constants twice: once
 * here and once in each app client, kept in step by a parity test that compared
 * the two copies. The app clients live in neo-minigames and neo-miniapps now, so
 * that comparison cannot run in one repo any more.
 *
 * The duplication is gone instead: @shared/protocol/host-bridges is the single
 * declaration and both ends import it. This guards that structure - a bridge
 * that re-declares a wire constant locally is back to two copies that can drift,
 * and no test would catch the drift.
 */
const bridgeDir = path.join(
  process.cwd(),
  "components/playarea/bridge",
);

const BRIDGES = [
  "use-embedded-credential-bridge.ts",
  "use-embedded-storage-bridge.ts",
  "use-embedded-wallet-bridge.ts",
] as const;

// Message names and protocol versions - the values an app client has to match
// byte for byte for the bridge to work at all.
const WIRE_LITERAL = /"(miniapp:[a-z-]+:[a-z-]+|neo-miniapp-[a-z-]+-v\d+)"/;

describe("host bridge wire protocol", () => {
  it.each(BRIDGES)("%s resolves its constants to the shared declaration", (file) => {
    // Directly or through ./events, which re-exports the shared module under
    // host-prefixed names. What matters is that the chain ends there rather
    // than in a local literal.
    const source = readFileSync(path.join(bridgeDir, file), "utf8");
    const viaShared = source.includes('from "@shared/protocol/host-bridges"');
    const viaEvents = /from "\.\/events"/.test(source);

    expect(viaShared || viaEvents).toBe(true);
    if (viaEvents) {
      const events = readFileSync(path.join(bridgeDir, "events.ts"), "utf8");
      expect(events).toContain('from "@shared/protocol/host-bridges"');
    }
  });

  it.each(BRIDGES)("%s declares no wire literal of its own", (file) => {
    const source = readFileSync(path.join(bridgeDir, file), "utf8");
    const offending = source
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .filter((line) => WIRE_LITERAL.test(line));

    // A non-empty list names the lines that re-introduced a second copy of a
    // constant the shared module already owns.
    expect(offending).toEqual([]);
  });
});

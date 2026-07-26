import assert from "node:assert/strict";
import test from "node:test";
import { hasPlatformBinding } from "./platform_binding_source.mjs";

test("detects composable platform bindings without requiring a primary contract mode", () => {
  const source = `
    contract: { mode: "custom", hash: "0x${"ab".repeat(20)}" },
    platformBindings: { game: "0x${"cd".repeat(20)}", social: { "neo-n3-testnet": "0x${"ef".repeat(20)}" } },
  `;
  assert.equal(hasPlatformBinding(source, "game"), true);
  assert.equal(hasPlatformBinding(source, "social"), true);
  assert.equal(hasPlatformBinding(source, "defi"), false);
});

test("does not treat empty binding values as configured", () => {
  assert.equal(hasPlatformBinding('platformBindings: { game: "" }', "game"), false);
  assert.equal(hasPlatformBinding('contract: { moduleId: "platform-game" }', "game"), false);
});

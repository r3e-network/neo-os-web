import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "glob";

const root = resolve(__dirname, "../../..");

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

describe("MiniApp framework adoption", () => {
  it("routes entrypoint actions through the root framework instead of raw context registration", () => {
    const files = [
      ...globSync("apps/*/src/main.tsx", { cwd: root }),
      "apps/shared/factory/runtime.tsx",
    ].sort();
    const offenders = files.filter((file) => read(file).includes("ctx.registerAction("));

    expect(offenders).toEqual([]);
  });

  it("keeps the legacy bulk action helper backed by framework actions", () => {
    const helper = read("apps/shared/utils/createActionHandlers.ts");

    expect(helper).toContain("ctx.framework.actions.register");
    expect(helper).not.toContain("ctx.registerAction(");
  });
});

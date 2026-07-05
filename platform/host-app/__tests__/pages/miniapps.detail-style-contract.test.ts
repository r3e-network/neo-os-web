import fs from "node:fs";
import path from "node:path";

describe("MiniApp detail style contract", () => {
  const detailSource = fs.readFileSync(
    path.join(process.cwd(), "pages/miniapps/[id].tsx"),
    "utf8",
  );
  const registrySource = fs.readFileSync(
    path.join(process.cwd(), "components/playarea/PlayAreaRegistry.tsx"),
    "utf8",
  );
  const sharedSource = fs.readFileSync(
    path.join(process.cwd(), "components/playarea/PlayAreaShared.tsx"),
    "utf8",
  );
  const operationPanelSource = fs.readFileSync(
    path.join(process.cwd(), "components/OperationPanel.tsx"),
    "utf8",
  );
  const combinedSource = [
    detailSource,
    registrySource,
    sharedSource,
    operationPanelSource,
  ].join("\n");

  it("uses the restrained platform detail shell instead of a soft gradient stage", () => {
    expect(detailSource).not.toContain("bg-[linear-gradient(");
    expect(detailSource).toContain("bg-[#f7f8fb]");
  });

  it("keeps detail panels within the platform radius and elevation scale", () => {
    expect(combinedSource).not.toMatch(/rounded-\[(2[1-9]|[3-9]\d)px\]/);
    expect(detailSource).not.toContain("rounded-2xl");
    expect(detailSource).not.toContain("shadow-xl");
    expect(detailSource).not.toContain("shadow-2xl");
    expect(operationPanelSource).not.toMatch(/rounded-\[[0-9]+px\]/);
  });

  it("keeps the action panel visually quiet instead of returning to a heavy form wizard", () => {
    expect(operationPanelSource).not.toContain("font-black");
    expect(operationPanelSource).not.toContain("rounded-2xl");
    expect(operationPanelSource).not.toContain("Advanced / Operator");
    expect(operationPanelSource).toContain('className="sr-only"');
    expect(operationPanelSource).toContain("Transaction workflow steps");
    expect(detailSource).toContain("primary-action-guide");
    expect(detailSource).toContain("advanced-operation-console");
    expect(detailSource).toContain("Host transaction console");
  });

  it("keeps the mobile transaction dock on the same wallet-style surface", () => {
    expect(detailSource).toContain("mobile-action-dock-shell");
    expect(detailSource).toContain("mobile-action-button");
    expect(detailSource).toContain("mobile-action-sheet-shell");
    expect(detailSource).not.toContain("backdrop-blur");
    expect(detailSource).not.toContain("shadow-lg");
    expect(detailSource).not.toContain(
      "shadow-[0_-16px_40px_rgba(15,23,42,0.12)]",
    );
    expect(detailSource).not.toContain("rounded-[14px]");
  });

  it("uses one consistent wallet status strip across desktop and mobile action surfaces", () => {
    expect(
      detailSource.match(/data-testid="action-console-wallet-status"/g) ?? [],
    ).toHaveLength(2);
    expect(detailSource).not.toContain("!walletConnected && (");
  });

  it("keeps embedded dApp loading chrome neutral and production-like", () => {
    expect(sharedSource).not.toContain("bg-[#9F9DF3]");
    expect(sharedSource).not.toContain("f5f2ff");
    expect(sharedSource).not.toContain("shadow-xl");
  });
});

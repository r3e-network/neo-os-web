import {
  coerceMiniAppDetailTemplate,
  coerceOperationEntries,
  resolveMiniAppDetailConfig,
} from "@/lib/miniapp-template";

describe("miniapp-template", () => {
  describe("coerceOperationEntries", () => {
    it("parses valid operations and ignores invalid ones", () => {
      const operations = coerceOperationEntries([
        {
          name: "Buy",
          method: "buyPosition",
          button_style: "primary",
          params: [
            { name: "side", type: "select", options: [{ label: "YES", value: "yes" }] },
            { name: "stake", type: "amount", required: true },
          ],
        },
        {
          name: "Missing Method",
        },
      ]);

      expect(operations).toHaveLength(1);
      expect(operations[0]).toEqual(
        expect.objectContaining({
          name: "Buy",
          method: "buyPosition",
          button_style: "primary",
        }),
      );
      expect(operations[0].params).toHaveLength(2);
    });

    it("deduplicates by method", () => {
      const operations = coerceOperationEntries([
        { name: "First", method: "act" },
        { name: "Second", method: "act" },
      ]);

      expect(operations).toHaveLength(1);
      expect(operations[0].name).toBe("First");
    });
  });

  describe("coerceMiniAppDetailTemplate", () => {
    it("supports prediction layout and normalized blocks", () => {
      const template = coerceMiniAppDetailTemplate({
        layout: "prediction_market",
        hero: { eyebrow: "Market" },
        tabs: [
          {
            label: "Overview",
            type: "content",
            blocks: [
              {
                type: "list",
                title: "Rules",
                items: ["Rule A", "Rule B"],
              },
            ],
          },
        ],
      });

      expect(template).not.toBeNull();
      expect(template?.layout).toBe("prediction");
      expect(template?.tabs[0]).toEqual(
        expect.objectContaining({
          type: "content",
          id: "overview",
        }),
      );
      expect(template?.tabs[0].blocks?.[0]).toEqual(
        expect.objectContaining({
          type: "bullet_list",
          title: "Rules",
        }),
      );
    });
  });

  describe("resolveMiniAppDetailConfig", () => {
    it("resolves template and operations from manifest fields", () => {
      const config = resolveMiniAppDetailConfig({
        manifest: {
          page_template: {
            layout: "prediction",
            tabs: [
              {
                id: "info",
                label: "Info",
                type: "content",
                content: "Market details",
              },
            ],
            operation_panel: {
              title: "Trade",
              operations: [
                { name: "Buy", method: "buyPosition" },
              ],
            },
          },
        },
      });

      expect(config.detailTemplate?.layout).toBe("prediction");
      expect(config.detailTemplate?.operation_panel?.title).toBe("Trade");
      expect(config.operations).toEqual([
        expect.objectContaining({ method: "buyPosition", name: "Buy" }),
      ]);
      expect(config.manifest).toEqual(expect.any(Object));
    });

    it("uses fallback operations when raw payload does not define them", () => {
      const config = resolveMiniAppDetailConfig(
        {
          detail_template: {
            tabs: [{ id: "overview", label: "Overview", type: "content", content: "Body" }],
          },
        },
        {
          operations: [{ name: "Fallback", method: "fallbackMethod" }],
        },
      );

      expect(config.operations).toEqual([
        expect.objectContaining({ method: "fallbackMethod", name: "Fallback" }),
      ]);
      expect(config.detailTemplate?.operation_panel?.operations).toEqual([
        expect.objectContaining({ method: "fallbackMethod", name: "Fallback" }),
      ]);
    });
  });
});

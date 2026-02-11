import * as explorerPage from "../../pages/explorer";

describe("explorer page", () => {
  it("exports a default component", () => {
    expect(typeof explorerPage.default).toBe("function");
  });
});

import * as explorerPage from "../../pages/explorer";

describe("explorer page", () => {
  it("exports getServerSideProps to avoid static prerender", () => {
    expect(typeof explorerPage.getServerSideProps).toBe("function");
  });
});

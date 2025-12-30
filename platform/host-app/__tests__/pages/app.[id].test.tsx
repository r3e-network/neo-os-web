import { getServerSideProps } from "../../pages/app/[id]";

describe("App Redirect Page", () => {
  describe("getServerSideProps", () => {
    it("should redirect to /miniapps/[id] with permanent redirect", async () => {
      const context = {
        params: { id: "test-app" },
        req: { headers: { host: "localhost:3000" } },
      } as any;

      const result = await getServerSideProps(context);

      expect(result).toEqual({
        redirect: {
          destination: "/miniapps/test-app",
          permanent: true,
        },
      });
    });

    it("should handle different app IDs correctly", async () => {
      const context = {
        params: { id: "miniapp-lottery" },
        req: { headers: { host: "localhost:3000" } },
      } as any;

      const result = await getServerSideProps(context);

      expect(result).toEqual({
        redirect: {
          destination: "/miniapps/miniapp-lottery",
          permanent: true,
        },
      });
    });

    it("should handle special characters in app ID", async () => {
      const context = {
        params: { id: "app-with-dashes" },
        req: { headers: { host: "localhost:3000" } },
      } as any;

      const result = await getServerSideProps(context);

      expect(result).toEqual({
        redirect: {
          destination: "/miniapps/app-with-dashes",
          permanent: true,
        },
      });
    });
  });
});

import handler from "@/pages/api/chain/health";
import { createMocks } from "node-mocks-http";

test("rejects non-neo chain_id", async () => {
  const { req, res } = createMocks({
    method: "GET",
    query: { chain_id: "unsupported-chain" },
  });

  await handler(req, res);
  expect(res._getStatusCode()).toBe(400);
});

import { isReadOnlyPostRequest } from "../../e2e/read-only-request";

function request(
  url: string,
  method = "POST",
  body: unknown = undefined,
) {
  return {
    method: () => method,
    url: () => url,
    postDataJSON: () => body,
  };
}

describe("read-only frontend request classification", () => {
  it.each([
    "getblockcount",
    "getversion",
    "invokefunction",
    "invokescript",
    "calculatenetworkfee",
  ])("allows Neo RPC read method %s", (method) => {
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/rpc/neo", "POST", { method }),
      ),
    ).toBe(true);
  });

  it("rejects Neo transaction relay requests", () => {
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/rpc/neo", "POST", {
          method: "sendrawtransaction",
        }),
      ),
    ).toBe(false);
  });

  it("rejects malformed or unknown Neo RPC requests", () => {
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/rpc/neo", "POST", {
          method: "unknown",
        }),
      ),
    ).toBe(false);
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/rpc/neo", "POST", null),
      ),
    ).toBe(false);
  });

  it("allows the explicit read-only proxy and edge endpoints", () => {
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/rpc/neo-read", "POST"),
      ),
    ).toBe(true);
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/edge/os-storage-get", "POST"),
      ),
    ).toBe(true);
  });

  it("does not classify non-POST or arbitrary endpoints as read-only", () => {
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/rpc/neo-read", "PUT"),
      ),
    ).toBe(false);
    expect(
      isReadOnlyPostRequest(
        request("https://neomini.app/api/account/delete", "POST"),
      ),
    ).toBe(false);
  });
});

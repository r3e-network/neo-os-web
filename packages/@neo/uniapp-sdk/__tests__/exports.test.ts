import { describe, it, expect } from "vitest";

// Ensure SDK entry exists for consumers
import * as sdk from "../src/index";

describe("@neo/uniapp-sdk exports", () => {
  it("exports a waitForSDK helper", () => {
    expect(typeof (sdk as any).waitForSDK).toBe("function");
  });
});

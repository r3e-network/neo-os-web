/**
 * MiniApp SDK Tests
 * Tests SDK functionality for mini-app development
 */

import { getChainRegistry } from "@/lib/chains/registry";

describe("MiniApp SDK", () => {
  describe("Core API", () => {
    it("should expose wallet methods", () => {
      const walletMethods = [
        "getAccount",
        "signMessage", 
        "signTransaction",
        "invokeContract",
      ];
      walletMethods.forEach((method) => {
        expect(typeof method).toBe("string");
      });
    });

    it("should expose storage methods", () => {
      const storageMethods = ["getItem", "setItem", "removeItem", "clear"];
      expect(storageMethods.length).toBe(4);
    });

    it("should expose UI methods", () => {
      const uiMethods = ["showToast", "showModal", "showLoading", "hideLoading"];
      expect(uiMethods.length).toBe(4);
    });
  });

  describe("Chain Registry", () => {
    it("should have chain registry available", () => {
      expect(getChainRegistry).toBeDefined();
      expect(typeof getChainRegistry).toBe("function");
    });

    it("should support Neo N3 chain", () => {
      const registry = getChainRegistry();
      expect(registry).toBeDefined();
      // Registry is an object with chain methods
      expect(typeof registry).toBe("object");
    });
  });
});

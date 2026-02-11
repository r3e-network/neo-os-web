/** @jest-environment node */

/**
 * NeoHub Account Service Tests
 */

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  hashPassword,
  verifyPassword,
  getNeoHubAccount,
  getFullNeoHubAccount,
  verifyAccountPassword,
  changePassword,
  unlinkIdentity,
  unlinkNeoAccount,
  getEncryptedKey,
  updateLastLogin,
} from "@/lib/neohub-account/service";

/** Helper: build a chainable Supabase query mock that resolves to `value` */
function chain(value: unknown = { data: null, error: null }) {
  const obj: Record<string, jest.Mock> = {};
  const self = () => obj;
  for (const m of ["select", "insert", "update", "delete", "eq", "single"]) {
    obj[m] = jest.fn(self);
  }
  // Make the chain thenable so `await supabase.from(...).select(...).eq(...)` works
  (obj as any).then = (res: (v: unknown) => void, _rej?: unknown) => {
    res(value);
    return Promise.resolve(value);
  };
  obj.single.mockReturnValue(Promise.resolve(value));
  return obj;
}

describe("NeoHub Account Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Pure crypto functions ──────────────────────────────────────────

  describe("hashPassword", () => {
    it("should produce a deterministic hash with a given salt", () => {
      const r1 = hashPassword("secret", "fixed-salt");
      const r2 = hashPassword("secret", "fixed-salt");
      expect(r1.hash).toBe(r2.hash);
      expect(r1.salt).toBe("fixed-salt");
    });

    it("should generate a random salt when none provided", () => {
      const r = hashPassword("secret");
      expect(r.salt).toBeTruthy();
      expect(r.salt.length).toBeGreaterThan(0);
      expect(r.hash.length).toBeGreaterThan(0);
    });

    it("should produce different hashes for different passwords", () => {
      const salt = "shared-salt";
      const a = hashPassword("alpha", salt);
      const b = hashPassword("bravo", salt);
      expect(a.hash).not.toBe(b.hash);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for matching password", () => {
      const { hash, salt } = hashPassword("correct-password");
      expect(verifyPassword("correct-password", hash, salt)).toBe(true);
    });

    it("should return false for wrong password", () => {
      const { hash, salt } = hashPassword("correct-password");
      expect(verifyPassword("wrong-password", hash, salt)).toBe(false);
    });
  });

  // ── getNeoHubAccount ───────────────────────────────────────────────

  describe("getNeoHubAccount", () => {
    it("should return mapped account on success", async () => {
      const row = {
        id: "acc-1",
        display_name: "Alice",
        avatar_url: "https://img.test/a.png",
        created_at: "2025-01-01",
        updated_at: "2025-06-01",
        last_login_at: "2025-06-15",
      };
      mockFrom.mockReturnValue(chain({ data: row, error: null }));

      const result = await getNeoHubAccount("acc-1");

      expect(result).toEqual({
        id: "acc-1",
        displayName: "Alice",
        avatarUrl: "https://img.test/a.png",
        createdAt: "2025-01-01",
        updatedAt: "2025-06-01",
        lastLoginAt: "2025-06-15",
      });
      expect(mockFrom).toHaveBeenCalledWith("neohub_accounts");
    });

    it("should return null on error", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: "not found" } }));

      const result = await getNeoHubAccount("missing");
      expect(result).toBeNull();
    });
  });

  // ── verifyAccountPassword ──────────────────────────────────────────

  describe("verifyAccountPassword", () => {
    it("should return true for correct password", async () => {
      const { hash, salt } = hashPassword("my-pass");
      mockFrom.mockReturnValue(chain({ data: { password_hash: hash, password_salt: salt } }));

      const ok = await verifyAccountPassword("acc-1", "my-pass");
      expect(ok).toBe(true);
    });

    it("should return false for wrong password", async () => {
      const { hash, salt } = hashPassword("my-pass");
      mockFrom.mockReturnValue(chain({ data: { password_hash: hash, password_salt: salt } }));

      const ok = await verifyAccountPassword("acc-1", "wrong");
      expect(ok).toBe(false);
    });

    it("should return false when account not found", async () => {
      mockFrom.mockReturnValue(chain({ data: null }));

      const ok = await verifyAccountPassword("missing", "any");
      expect(ok).toBe(false);
    });
  });

  // ── changePassword ─────────────────────────────────────────────────

  describe("changePassword", () => {
    it("should change password when current is valid", async () => {
      const { hash, salt } = hashPassword("old-pass");

      // First call: verifyAccountPassword reads hash
      // Second call: update password
      // Third call: logAccountChange insert
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // verify password select
          return chain({ data: { password_hash: hash, password_salt: salt } });
        }
        // update + log insert
        return chain({ data: null, error: null });
      });

      const result = await changePassword("acc-1", "old-pass", "new-pass");
      expect(result).toEqual({ success: true });
    });

    it("should reject when current password is wrong", async () => {
      const { hash, salt } = hashPassword("real-pass");
      mockFrom.mockReturnValue(chain({ data: { password_hash: hash, password_salt: salt } }));

      const result = await changePassword("acc-1", "wrong", "new");
      expect(result).toEqual({ success: false, error: "Invalid current password" });
    });
  });

  // ── getEncryptedKey ────────────────────────────────────────────────

  describe("getEncryptedKey", () => {
    it("should return encrypted key data", async () => {
      const keyData = {
        wallet_address: "NXaddr",
        encrypted_private_key: "enc-data",
      };
      mockFrom.mockReturnValue(chain({ data: keyData }));

      const result = await getEncryptedKey("NXaddr");
      expect(result).toEqual(keyData);
      expect(mockFrom).toHaveBeenCalledWith("encrypted_keys");
    });

    it("should return null when not found", async () => {
      mockFrom.mockReturnValue(chain({ data: null }));

      const result = await getEncryptedKey("NXmissing");
      expect(result).toBeNull();
    });
  });

  // ── updateLastLogin ────────────────────────────────────────────────

  describe("updateLastLogin", () => {
    it("should call update on neohub_accounts", async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));

      await updateLastLogin("acc-1");

      expect(mockFrom).toHaveBeenCalledWith("neohub_accounts");
    });
  });
});

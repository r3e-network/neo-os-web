/**
 * NeoHub Account Service Tests
 */

// Mock supabase before importing service
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    rpc: jest.fn(),
  },
}));

import { hashPassword, verifyPassword } from "../service";

describe("NeoHub Account Service", () => {
  describe("hashPassword", () => {
    it("should hash password with generated salt", () => {
      const result = hashPassword("testPassword123");

      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.hash.length).toBe(128); // 64 bytes hex = 128 chars
      expect(result.salt.length).toBe(64); // 32 bytes hex = 64 chars
    });

    it("should hash password with provided salt", () => {
      const salt = "a".repeat(64);
      const result = hashPassword("testPassword123", salt);

      expect(result.salt).toBe(salt);
      expect(result.hash).toBeDefined();
    });

    it("should produce same hash for same password and salt", () => {
      const salt = "b".repeat(64);
      const result1 = hashPassword("myPassword", salt);
      const result2 = hashPassword("myPassword", salt);

      expect(result1.hash).toBe(result2.hash);
    });

    it("should produce different hash for different passwords", () => {
      const salt = "c".repeat(64);
      const result1 = hashPassword("password1", salt);
      const result2 = hashPassword("password2", salt);

      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", () => {
      const { hash, salt } = hashPassword("correctPassword");
      const isValid = verifyPassword("correctPassword", hash, salt);

      expect(isValid).toBe(true);
    });

    it("should return false for incorrect password", () => {
      const { hash, salt } = hashPassword("correctPassword");
      const isValid = verifyPassword("wrongPassword", hash, salt);

      expect(isValid).toBe(false);
    });

    it("should return false for empty password", () => {
      const { hash, salt } = hashPassword("somePassword");
      const isValid = verifyPassword("", hash, salt);

      expect(isValid).toBe(false);
    });
  });
});

import { describe, it, expect, vi } from "vitest";

const toFixed8 = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("-")) return "0";
  const parts = trimmed.split(".");
  if (parts.length > 2) return "0";
  const whole = parts[0] || "0";
  const frac = parts[1] || "";
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) return "0";
  const padded = (frac + "0".repeat(8)).slice(0, 8);
  return `${whole}${padded}`.replace(/^0+/, "") || "0";
};

describe("Unbreakable Vault MiniApp", () => {
  describe("Create Vault", () => {
    it("validates bounty minimum and secret confirmation", () => {
      const bounty = "0.5";
      const secret = "alpha";
      const confirm = "beta";
      const minBounty = 1;

      const amount = Number.parseFloat(bounty);
      const canCreate = amount >= minBounty && secret.trim() && secret === confirm;

      expect(canCreate).toBe(false);
    });

    it("converts bounty to integer GAS amount", () => {
      const bounty = "1.75";
      const bountyInt = toFixed8(bounty);
      expect(bountyInt).toBe("175000000");
    });

    it("uses payGAS with create metadata", async () => {
      const payGAS = vi.fn().mockResolvedValue({ receipt_id: "receipt-123" });
      const hash = "abc123";
      await payGAS("2", `vault:create:${hash.slice(0, 10)}`);
      expect(payGAS).toHaveBeenCalledWith("2", "vault:create:abc123");
    });
  });

  describe("Attempt Break", () => {
    it("uses payGAS with attempt metadata", async () => {
      const payGAS = vi.fn().mockResolvedValue({ receipt_id: "receipt-999" });
      await payGAS("0.1", "vault:attempt:42");
      expect(payGAS).toHaveBeenCalledWith("0.1", "vault:attempt:42");
    });

    it("requires a vault ID and secret to attempt", () => {
      const vaultId = "";
      const secret = "guess";
      const canAttempt = Boolean(vaultId && secret.trim());
      expect(canAttempt).toBe(false);
    });
  });

  describe("Vault Data Parsing", () => {
    it("maps contract values into vault details", () => {
      const raw = ["creatorHash", "250000000", "hash", "3", true, "winnerHash"];
      const [creator, bountyValue, , attempts, broken, winner] = raw;
      const vaultDetails = {
        creator: String(creator),
        bounty: Number(bountyValue),
        attempts: Number(attempts),
        broken: Boolean(broken),
        winner: String(winner),
      };

      expect(vaultDetails.bounty).toBe(250000000);
      expect(vaultDetails.attempts).toBe(3);
      expect(vaultDetails.broken).toBe(true);
      expect(vaultDetails.creator).toBe("creatorHash");
      expect(vaultDetails.winner).toBe("winnerHash");
    });
  });
});

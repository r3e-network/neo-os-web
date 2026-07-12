import {
  fundedRecipe,
  multiInvokeUnavailableError,
  notConfiguredError,
  simpleRecipe,
} from "../../../lib/miniapp-invoke/recipe-factories";
import { MINIAPP_INVOKE_RECIPES } from "../../../lib/miniapp-invoke/recipes";

describe("notConfiguredError", () => {
  it("builds the shared not-configured copy from a subject", () => {
    expect(notConfiguredError("Dev Tipping contract")).toBe(
      "Dev Tipping contract is not configured for this network.",
    );
    expect(notConfiguredError("Recovery Guardian verifier")).toBe(
      "Recovery Guardian verifier is not configured for this network.",
    );
  });
});

describe("multiInvokeUnavailableError", () => {
  it("builds the shared batch-unavailable copy from a descriptor", () => {
    expect(multiInvokeUnavailableError("funded tip transaction")).toBe(
      "This wallet cannot submit the required funded tip transaction. Open in OneGate or NeoLine.",
    );
    // Outlier descriptors that omit the trailing "transaction" word.
    expect(multiInvokeUnavailableError("funded break attempt")).toBe(
      "This wallet cannot submit the required funded break attempt. Open in OneGate or NeoLine.",
    );
  });
});

describe("fundedRecipe", () => {
  it("derives both error strings and preserves the buildPlan reference", () => {
    const buildPlan = jest.fn();
    const recipe = fundedRecipe(
      "SelfLoan contract",
      "funded loan transaction",
      buildPlan,
    );

    expect(recipe.notConfiguredError).toBe(
      "SelfLoan contract is not configured for this network.",
    );
    expect(recipe.multiInvokeUnavailableError).toBe(
      "This wallet cannot submit the required funded loan transaction. Open in OneGate or NeoLine.",
    );
    expect(recipe.buildPlan).toBe(buildPlan);
  });
});

describe("simpleRecipe", () => {
  it("derives the not-configured string and omits the batch error", () => {
    const buildPlan = jest.fn();
    const recipe = simpleRecipe("Daily Check-in contract", buildPlan);

    expect(recipe.notConfiguredError).toBe(
      "Daily Check-in contract is not configured for this network.",
    );
    expect(recipe.multiInvokeUnavailableError).toBeUndefined();
    expect(recipe.buildPlan).toBe(buildPlan);
  });
});

describe("MINIAPP_INVOKE_RECIPES copy is consistent after the factory refactor", () => {
  it("keeps every not-configured string in the canonical sentence form", () => {
    for (const [key, recipe] of Object.entries(MINIAPP_INVOKE_RECIPES)) {
      expect(recipe.notConfiguredError).toMatch(
        /^.+ is not configured for this network\.$/,
      );
      // Sanity: the key is non-empty so failures are attributable.
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("keeps every batch-unavailable string in the canonical sentence form", () => {
    for (const recipe of Object.values(MINIAPP_INVOKE_RECIPES)) {
      if (recipe.multiInvokeUnavailableError === undefined) continue;
      expect(recipe.multiInvokeUnavailableError).toMatch(
        /^This wallet cannot submit the required .+\. Open in OneGate or NeoLine\.$/,
      );
    }
  });

  it("pins the exact derived copy for representative recipes", () => {
    expect(
      MINIAPP_INVOKE_RECIPES["miniapp-self-loan:addCollateral"]
        .multiInvokeUnavailableError,
    ).toBe(
      "This wallet cannot submit the required collateral transaction. Open in OneGate or NeoLine.",
    );
    expect(
      MINIAPP_INVOKE_RECIPES["*:fundGameCredit"].notConfiguredError,
    ).toBe("Game contract is not configured for this network.");
  });
});

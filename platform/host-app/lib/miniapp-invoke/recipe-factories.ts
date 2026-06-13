import type { InvokeRecipe } from "./executor";

/**
 * Builds the standard "not configured" copy shared by every invoke recipe.
 * `subject` is the human label of the missing dependency, e.g.
 * `"Dev Tipping contract"` or `"Recovery Guardian verifier"`.
 */
export function notConfiguredError(subject: string): string {
  return `${subject} is not configured for this network.`;
}

/**
 * Builds the standard "wallet cannot batch" copy shown when a NEP-21
 * deposit-then-act plan needs `invokeMultiple` but the wallet lacks it.
 * `descriptor` is the full phrase naming the action, e.g.
 * `"funded tip transaction"`, `"collateral transaction"`, or
 * `"funded break attempt"`.
 */
export function multiInvokeUnavailableError(descriptor: string): string {
  return `This wallet cannot submit the required ${descriptor}. Open in OneGate or NeoLine.`;
}

/**
 * Recipe factory for funded (deposit-then-act) flows. Derives both the
 * `notConfiguredError` and `multiInvokeUnavailableError` copy from a single
 * subject/descriptor so the wording stays consistent across every funded
 * recipe.
 */
export function fundedRecipe(
  subject: string,
  descriptor: string,
  buildPlan: InvokeRecipe["buildPlan"],
): InvokeRecipe {
  return {
    notConfiguredError: notConfiguredError(subject),
    multiInvokeUnavailableError: multiInvokeUnavailableError(descriptor),
    buildPlan,
  };
}

/**
 * Recipe factory for single-invocation flows that never batch. Derives the
 * `notConfiguredError` copy from the subject.
 */
export function simpleRecipe(
  subject: string,
  buildPlan: InvokeRecipe["buildPlan"],
): InvokeRecipe {
  return {
    notConfiguredError: notConfiguredError(subject),
    buildPlan,
  };
}

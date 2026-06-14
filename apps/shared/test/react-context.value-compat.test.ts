import { describe, expect, it } from "vitest";

import {
  createObservable,
  withValueCompat as withValueCompatFromContext,
} from "@shared/react/context";
import { withValueCompat as withValueCompatFromChain } from "@shared/services/ChainService";

describe("withValueCompat extraction parity (A10)", () => {
  it("ChainService re-exports the same withValueCompat as the context module", () => {
    expect(withValueCompatFromChain).toBe(withValueCompatFromContext);
  });

  it("bridges get()/set() and the legacy .value accessor in both directions", () => {
    const obs = withValueCompatFromContext(createObservable(0));

    expect(obs.value).toBe(0);
    expect(obs.get()).toBe(0);

    obs.set(5);
    expect(obs.value).toBe(5);

    obs.value = 9;
    expect(obs.get()).toBe(9);
  });

  it("notifies subscribers when written through either accessor", () => {
    const obs = withValueCompatFromContext(createObservable("a"));
    let notified = 0;
    obs.subscribe(() => {
      notified += 1;
    });

    obs.set("b");
    obs.value = "c";
    expect(notified).toBe(2);
    expect(obs.value).toBe("c");
  });
});

import { createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";

type StateRecord = Record<string, Observable<unknown>>;

/**
 * Helper to reduce PlayArea computed passthrough boilerplate.
 *
 * Instead of writing 15 lines of:
 *   const foo = createDerived(() => String(state.foo?.get() ?? ""), [state.foo]);
 *   const bar = createDerived(() => Boolean(state.bar?.get() ?? false), [state.bar]);
 *
 * Write:
 *   const { str, bool, val } = useStateBindings(state);
 *   // str("foo").get(), bool("bar").get(), etc.
 *
 * Or use the batch form for named bindings:
 *   const { foo, bar } = bindState(state, {
 *     foo: "string",
 *     bar: "boolean",
 *   });
 */

/** Create on-demand accessor helpers for a state record. */
export function useStateBindings(state: StateRecord) {
  /** Read a string value (defaults to "") */
  const str = (key: string, fallback = ""): Observable<string> =>
    createDerived(() => String(state[key]?.get() ?? fallback), state[key] ? [state[key]] : []);

  /** Read a boolean value (defaults to false) */
  const bool = (key: string): Observable<boolean> =>
    createDerived(() => Boolean(state[key]?.get() ?? false), state[key] ? [state[key]] : []);

  /** Read a number value (defaults to 0) */
  const num = (key: string, fallback = 0): Observable<number> =>
    createDerived(() => Number(state[key]?.get() ?? fallback), state[key] ? [state[key]] : []);

  /** Read a raw value with a typed cast */
  const val = <T>(key: string, fallback: T | null = null): Observable<T | null> =>
    createDerived(() => (state[key]?.get() ?? fallback) as T | null, state[key] ? [state[key]] : []);

  return { str, bool, num, val };
}

import { computed } from "vue";
import type { ComputedRef, Ref } from "vue";

type StateRecord = Record<string, Ref<unknown>>;

/**
 * Helper to reduce PlayArea computed passthrough boilerplate.
 *
 * Instead of writing 15 lines of:
 *   const foo = computed(() => String(props.state.foo?.value ?? ""));
 *   const bar = computed(() => Boolean(props.state.bar?.value ?? false));
 *
 * Write:
 *   const { str, bool, val } = useStateBindings(props.state);
 *   // In template: {{ str("foo") }}, v-if="bool("bar")", etc.
 *
 * Or use the batch form for named bindings:
 *   const { foo, bar } = bindState(props.state, {
 *     foo: "string",
 *     bar: "boolean",
 *   });
 */

/** Create on-demand accessor helpers for a state record. */
export function useStateBindings(state: StateRecord) {
  /** Read a string value (defaults to "") */
  const str = (key: string, fallback = ""): ComputedRef<string> =>
    computed(() => String(state[key]?.value ?? fallback));

  /** Read a boolean value (defaults to false) */
  const bool = (key: string): ComputedRef<boolean> =>
    computed(() => Boolean(state[key]?.value ?? false));

  /** Read a number value (defaults to 0) */
  const num = (key: string, fallback = 0): ComputedRef<number> =>
    computed(() => Number(state[key]?.value ?? fallback));

  /** Read a raw value with a typed cast */
  const val = <T>(key: string, fallback: T | null = null): ComputedRef<T | null> =>
    computed(() => (state[key]?.value ?? fallback) as T | null);

  return { str, bool, num, val };
}

import { computed, type ComputedRef } from "vue";

type SidebarValue = string | number | boolean | null | undefined;

type SidebarItemDef = {
  labelKey: string;
  value: () => SidebarValue;
};

/**
 * Factory that eliminates repeated `computed(() => [{ label: t(key), value: expr }])` boilerplate
 * found across miniapp index pages.
 *
 * Each item provides an i18n label key and a getter function for the reactive value.
 * Returns a computed array of `{ label, value }` objects suitable for `<SidebarPanel :items>`.
 */
export function createSidebarItems(
  t: (key: string) => string,
  items: SidebarItemDef[]
): ComputedRef<Array<{ label: string; value: SidebarValue }>> {
  return computed(() =>
    items.map((item) => ({
      label: t(item.labelKey),
      value: item.value(),
    }))
  );
}

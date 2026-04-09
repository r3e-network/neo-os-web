import { createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";

type SidebarValue = string | number | boolean | null | undefined;

type SidebarItemDef = {
  labelKey: string;
  value: () => SidebarValue;
};

/**
 * Factory that eliminates repeated sidebar item boilerplate.
 *
 * Each item provides an i18n label key and a getter function for the reactive value.
 * Returns a derived observable array of `{ label, value }` objects.
 */
export function createSidebarItems(
  t: (key: string) => string,
  items: SidebarItemDef[]
): Observable<Array<{ label: string; value: SidebarValue }>> {
  return createDerived(
    () => items.map((item) => ({ label: t(item.labelKey), value: item.value() })),
    [],
  );
}

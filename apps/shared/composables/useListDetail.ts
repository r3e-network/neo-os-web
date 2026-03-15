/**
 * List→Detail Navigation Composable
 *
 * State machine for navigating between a list view and a detail view
 * within the left panel of a two-column layout.
 *
 * @example
 * ```ts
 * interface Proposal { id: string; title: string; status: string }
 *
 * const { view, selectedItem, items, filter, filteredItems, selectItem, goBack } =
 *   useListDetail<Proposal>();
 *
 * // Populate items
 * items.value = fetchedProposals;
 *
 * // Navigate to detail
 * selectItem(proposals[0]);
 *
 * // Return to list
 * goBack();
 * ```
 */

import { ref, computed, type Ref } from "vue";

export function useListDetail<T extends { id: string | number }>() {
  const view: Ref<"list" | "detail"> = ref("list");
  const selectedItem: Ref<T | null> = ref(null) as Ref<T | null>;
  const items: Ref<T[]> = ref([]) as Ref<T[]>;
  const filter: Ref<string> = ref("");

  const filteredItems = computed(() => {
    const query = filter.value.toLowerCase().trim();
    if (!query) return items.value;

    return items.value.filter((item) => {
      // Search across all string values of the item
      return Object.values(item).some(
        (val) => typeof val === "string" && val.toLowerCase().includes(query),
      );
    });
  });

  const selectItem = (item: T) => {
    selectedItem.value = item;
    view.value = "detail";
  };

  const goBack = () => {
    selectedItem.value = null;
    view.value = "list";
  };

  return {
    /** Current view mode: "list" or "detail" */
    view,
    /** Currently selected item (null when in list view) */
    selectedItem,
    /** Full list of items */
    items,
    /** Search/filter query string */
    filter,
    /** Items filtered by the current query */
    filteredItems,
    /** Navigate to detail view for the given item */
    selectItem,
    /** Return to list view */
    goBack,
  };
}

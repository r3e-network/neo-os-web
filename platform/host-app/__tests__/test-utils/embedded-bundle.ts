import { fireEvent, screen } from "@testing-library/react";

/**
 * Opens every deferred MiniApp bundle rendered in the current tree.
 *
 * `EmbeddedDappSurface` shows artwork and metadata first and only requests the
 * CDN bundle once the visitor opens it, so a test that asserts on the iframe has
 * to perform that action. Suites covering frame behaviour rather than the
 * deferral itself call this immediately after render.
 */
export function openEmbeddedBundles(): number {
  const buttons = screen.queryAllByTestId(/-open$/);
  for (const button of buttons) fireEvent.click(button);
  return buttons.length;
}

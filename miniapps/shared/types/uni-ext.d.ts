/**
 * Ambient type declarations for UniApp APIs not covered by @dcloudio/types.
 *
 * These extend the global `uni` namespace so that call-sites compile
 * without @ts-expect-error suppressions.
 */

interface UniSetClipboardDataOptions {
  data: string;
  success?: () => void;
  fail?: (err: unknown) => void;
  complete?: () => void;
}

interface UniIntersectionObserver {
  relativeToViewport(margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  }): UniIntersectionObserver;
  observe(
    selector: string,
    callback: (res: { intersectionRatio: number }) => void,
  ): void;
  disconnect(): void;
}

declare namespace uni {
  function setClipboardData(options: UniSetClipboardDataOptions): void;
  function createIntersectionObserver(
    component: any,
    options?: { thresholds?: number[]; initialRatio?: number; observeAll?: boolean },
  ): UniIntersectionObserver;
}

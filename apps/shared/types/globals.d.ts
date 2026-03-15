/** Global UniApp runtime APIs available on globalThis */
export interface UniAppGlobals {
  uni?: typeof uni;
  plus?: {
    runtime?: {
      openURL?: (url: string) => void;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

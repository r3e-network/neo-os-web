import { afterEach, describe, expect, it } from "vitest";

import { getLocale } from "../utils/i18n";

const originalHref = window.location.href;
const originalLanguageDescriptor = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "language",
);
const originalLanguagesDescriptor = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "languages",
);

function setNavigatorLanguages(primary: string, languages = [primary]) {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    get: () => primary,
  });
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    get: () => languages,
  });
}

afterEach(() => {
  window.history.replaceState({}, "", originalHref);
  if (originalLanguageDescriptor) {
    Object.defineProperty(
      Navigator.prototype,
      "language",
      originalLanguageDescriptor,
    );
  }
  if (originalLanguagesDescriptor) {
    Object.defineProperty(
      Navigator.prototype,
      "languages",
      originalLanguagesDescriptor,
    );
  }
});

describe("miniapp locale detection", () => {
  it("prefers OneGate language params over system language", () => {
    setNavigatorLanguages("en-US");
    window.history.replaceState(
      {},
      "",
      "/miniapps/gas-lucky-pool/index.html?source=onegate&lang=ja-JP",
    );

    expect(getLocale()).toBe("ja");
  });

  it("uses Japanese from the system language list when OneGate does not provide a locale", () => {
    setNavigatorLanguages("fr-FR", ["ja-JP", "fr-FR"]);
    window.history.replaceState(
      {},
      "",
      "/miniapps/gas-lucky-pool/index.html?source=onegate",
    );

    expect(getLocale()).toBe("ja");
  });

  it("falls back to English for unsupported OneGate or system languages", () => {
    setNavigatorLanguages("fr-FR");
    window.history.replaceState(
      {},
      "",
      "/miniapps/gas-lucky-pool/index.html?source=onegate&locale=fr-FR",
    );

    expect(getLocale()).toBe("en");
  });
});

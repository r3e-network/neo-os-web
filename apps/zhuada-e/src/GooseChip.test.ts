import { describe, expect, it } from "vitest";
import { collectionPortraitFor } from "./GooseChip";
import { SCENES } from "./logic/scenes";

describe("collectionPortraitFor", () => {
  it("maps every scene variant to its own stable portrait", () => {
    expect(SCENES.map(({ goose }) => collectionPortraitFor(goose))).toEqual([
      "./art/geese/goose-00.webp",
      "./art/geese/goose-01.webp",
      "./art/geese/goose-02.webp",
      "./art/geese/goose-03.webp",
      "./art/geese/goose-04.webp",
      "./art/geese/goose-05.webp",
      "./art/geese/goose-06.webp",
      "./art/geese/goose-07.webp",
      "./art/geese/goose-08.webp",
    ]);
  });

  it("also recognizes a structurally persisted variant", () => {
    expect(collectionPortraitFor({ ...SCENES[4]!.goose })).toBe("./art/geese/goose-04.webp");
  });
});

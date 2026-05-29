import fs from "node:fs";
import path from "node:path";

describe("MiniApps catalog style contract", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "pages/miniapps/index.tsx"),
    "utf8",
  );

  it("uses the restrained platform surface instead of a pastel hero shell", () => {
    expect(source).not.toContain("bg-[linear-gradient(");
    expect(source).not.toContain("backdrop-blur-xl");
    expect(source).not.toContain("bg-[#9F9DF3]");
  });

  it("keeps primary catalog radii and shadows professional", () => {
    expect(source).not.toContain("rounded-2xl");
    expect(source).not.toMatch(/rounded-\[(2[1-9]|[3-9]\d)px\]/);
    expect(source).not.toMatch(/shadow-\[0_1[458]_px/);
  });
});

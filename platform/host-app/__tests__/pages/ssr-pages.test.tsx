import fs from "fs";
import path from "path";

const pages = ["app/[id].tsx", "launch/[id].tsx", "miniapps/[id].tsx", "container.tsx"];

const pagesDir = path.join(__dirname, "..", "..", "pages");

describe("host pages SSR", () => {
  it.each(pages)("exports getServerSideProps in %s", (pageFile) => {
    const source = fs.readFileSync(path.join(pagesDir, pageFile), "utf8");
    expect(source).toMatch(/export const getServerSideProps/);
  });
});

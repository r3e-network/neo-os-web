import fs from "fs";
import path from "path";

const pages = [
  "account.tsx",
  "analytics.tsx",
  "download.tsx",
  "home.tsx",
  "leaderboard.tsx",
];

const pagesDir = path.join(__dirname, "..", "..", "pages");

describe("host pages SSR", () => {
  it.each(pages)("exports getServerSideProps in %s", (pageFile) => {
    const source = fs.readFileSync(path.join(pagesDir, pageFile), "utf8");
    expect(source).toMatch(/export const getServerSideProps/);
  });
});

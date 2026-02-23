const fs = require('fs');
const files = ['platform/host-app/lib/miniapp-admin.ts', 'platform/host-app/lib/miniapp-definitions.ts'];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/function normalizeMediaVariants.*?\}\s*\n\s*\n/s, `function normalizeMediaVariants(raw: unknown): Array<{
  url: string;
  theme?: "light" | "dark" | "any";
  density?: "1x" | "2x" | "3x";
  locale?: string;
}> {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map((item) => asObject(item))
    .map((item) => {
      const getStr = (v: unknown) => typeof v === "string" ? v.trim() : "";
      const url = getStr(item.url);
      if (!url) return null;
      const themeRaw = getStr(item.theme).toLowerCase();
      const densityRaw = getStr(item.density).toLowerCase();
      const locale = getStr(item.locale);
      const res: any = { url };
      if (themeRaw === "light" || themeRaw === "dark" || themeRaw === "any") res.theme = themeRaw;
      if (densityRaw === "1x" || densityRaw === "2x" || densityRaw === "3x") res.density = densityRaw;
      if (locale) res.locale = locale;
      return res;
    });
  return items.filter((x) => x !== null) as any;
}\n\n`);
  fs.writeFileSync(file, content);
}

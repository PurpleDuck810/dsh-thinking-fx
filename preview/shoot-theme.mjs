import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 200 }, deviceScaleFactor: 2 });
for (const [name, theme] of [["row-dark", ""], ["row-light", "&theme=light"]]) {
  await page.goto(`http://127.0.0.1:53901/preview/preview.html?fx=glyph&frame=0&size=52&scale=1.4${theme}`);
  await page.waitForTimeout(500);
  await page.locator("#row").screenshot({ path: `${name}.png` });
  console.log(name);
}
await browser.close();

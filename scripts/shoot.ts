import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3010";
const targets: Array<[string, string]> = [
  ["home", "/home"],
  ["inbox", "/authority-requests"],
  ["onboarding", "/fleet-onboarding"],
  ["monitoring", "/compliance-monitoring"],
  ["audit", "/audit"],
  ["accuracy", "/accuracy"],
];

async function main() {
  const only = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", "reviewer@bolt.eu");
  await page.fill("#password", "sentinel");
  await Promise.all([page.waitForURL("**/home", { timeout: 20000 }).catch(() => {}), page.click('button[type=submit]')]);
  await page.waitForTimeout(1500);

  const list = only.length ? targets.filter(([n]) => only.includes(n) || only.includes(n.split(":")[0])) : targets;
  for (const [name, path] of list) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: true });
    console.log("shot", name);
  }
  // also a workspace: open the first authority request
  if (!only.length || only.includes("workspace")) {
    await page.goto(`${BASE}/authority-requests`, { waitUntil: "networkidle" }).catch(() => {});
    const firstRef = page.locator("table tbody tr a").first();
    if (await firstRef.count()) {
      await firstRef.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `/tmp/shot-workspace.png`, fullPage: true });
      console.log("shot workspace");
    }
  }
  await browser.close();
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
export {};

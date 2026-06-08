import { chromium } from "@playwright/test";

const baseUrl = (process.env.QIMS_WEB_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const password = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";

const accounts = [
  ["superadmin@qims.local", "Super Admin"],
  ["supervisor@qims.local", "Supervisor"],
  ["qamanager@qims.local", "QA Manager"],
  ["auditor@qims.local", "Auditor"],
] as const;

const browser = await chromium.launch({ headless: true });
const results: Array<{
  role: string;
  email: string;
  title: string;
  buttonCount: number;
  mobileHorizontalOverflow: boolean;
  consoleErrors: string[];
}> = [];

for (const [email, role] of accounts) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector(".app-shell", { timeout: 20_000 });
  await page.waitForTimeout(1_000);

  const title = await page.locator("h1").first().innerText();
  const buttonCount = await page.locator("button").count();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobileHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );

  results.push({
    role,
    email,
    title,
    buttonCount,
    mobileHorizontalOverflow,
    consoleErrors,
  });
  await context.close();
}

await browser.close();

const failing = results.filter(
  (result) => result.consoleErrors.length > 0 || result.mobileHorizontalOverflow,
);
console.log(JSON.stringify(results, null, 2));

if (failing.length > 0) {
  throw new Error("Browser QA found console errors or mobile horizontal overflow.");
}

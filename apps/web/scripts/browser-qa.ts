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
  featureChecks: Record<string, boolean>;
  mobileHorizontalOverflow: boolean;
  consoleErrors: string[];
}> = [];

async function visibleText(page: import("@playwright/test").Page, text: string) {
  try {
    await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

async function clickNav(page: import("@playwright/test").Page, label: string) {
  const item = page.getByRole("button", { name: new RegExp(label, "i") }).first();
  if ((await item.count()) === 0) return false;
  await item.click();
  await page.waitForTimeout(1_000);
  return true;
}

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
  const featureChecks: Record<string, boolean> = {};

  if (role === "Super Admin") {
    featureChecks.adminNav = await clickNav(page, "Admin");
    featureChecks.createUserForm = await visibleText(page, "Create User");
    featureChecks.rolePermissionForm = await visibleText(page, "Update Role Permissions");
    featureChecks.masterDataForm = await visibleText(page, "Master Data Create/Edit");
  }

  if (role === "Supervisor") {
    featureChecks.commandNav = await clickNav(page, "Command");
    featureChecks.shiftCalendar = await visibleText(page, "Calendar View");
    featureChecks.dragPriorityBoard = await visibleText(page, "Drag Priority Board");
    featureChecks.priorityBoardState =
      (await visibleText(page, "Reason for priority changes")) ||
      (await visibleText(page, "Belum ada task untuk priority board."));
  }

  if (role === "QA Manager") {
    featureChecks.reportsNav = await clickNav(page, "Reports");
    featureChecks.taskChart = await visibleText(page, "Task Completion Chart");
    featureChecks.issueChart = await visibleText(page, "Issue Severity Chart");
    featureChecks.exportUi = await visibleText(page, "Export Report");
  }

  if (role === "Auditor") {
    featureChecks.auditNav = await clickNav(page, "Audit");
    featureChecks.auditTrail = await visibleText(page, "Audit Trail");
    featureChecks.sopEvidence = await visibleText(page, "SOP Acknowledgement");
    featureChecks.noExportUi = !(await visibleText(page, "Export Report"));
  }

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
    featureChecks,
    mobileHorizontalOverflow,
    consoleErrors,
  });
  await context.close();
}

await browser.close();

const failing = results.filter(
  (result) =>
    result.consoleErrors.length > 0 ||
    result.mobileHorizontalOverflow ||
    Object.values(result.featureChecks).some((passed) => !passed),
);
console.log(JSON.stringify(results, null, 2));

if (failing.length > 0) {
  throw new Error("Browser QA found console errors, missing MVP UI, or mobile horizontal overflow.");
}

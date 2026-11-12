import { expect, test, type Page } from "@playwright/test";

async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe.serial("CPH CRM", () => {
  let matterUrl = "";

  test("Today dashboard shows the week at a glance", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
    await expect(page.getByText("Hearings & deadlines")).toBeVisible();
    await expect(page.getByText("RFO hearing — custody & support")).toBeVisible();
    await page.screenshot({ path: "test-results/screens/today.png", fullPage: true });
  });

  test("New intake with a live conflict hit creates the matter", async ({ page }) => {
    await page.goto("/matters/new");
    await page.getByLabel("First name").fill("Test");
    await page.getByLabel("Last name(s)").fill("Cliente Nuevo");
    await page.getByLabel("Phone", { exact: true }).fill("3105550199");
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByRole("button", { name: /Unlawful Detainer/ }).click();
    await page.getByLabel("Case caption").fill("Cliente Nuevo v. Marsh");
    await page.getByRole("button", { name: "Add party" }).click();
    await page.getByPlaceholder("Full name").fill("Kevin Marsh");
    // Suggest the existing contact so the opposing party isn't duplicated
    await page.getByRole("button", { name: /Marsh, Kevin/ }).click();
    await expect(page.getByText("existing contact")).toBeVisible();
    // Live conflict check finds the existing opposing party
    await expect(page.getByRole("link", { name: "Marsh, Kevin" })).toBeVisible();
    await page.screenshot({ path: "test-results/screens/intake-conflict.png", fullPage: true });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.getByLabel("Flat fee", { exact: true }).fill("1500");
    await page.getByLabel("Payment received today").fill("500");
    await expect(page.getByText("$1,000.00")).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("checkbox", { name: /I reviewed the client/ }).check();
    await page.getByRole("button", { name: "Create matter" }).click();

    await page.waitForURL(/\/matters\/[0-9a-f-]{36}$/);
    matterUrl = page.url();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cliente Nuevo, Test — UD (Plaintiff)");
    await expect(page.getByText("$1,000.00").first()).toBeVisible();
  });

  test("Stage, checklist, dates and payments update the matter", async ({ page }) => {
    await page.goto(matterUrl);
    await page.getByRole("button", { name: /Notice Served/ }).click();
    await toast(page, "Stage: Notice Served");

    const first = page.getByRole("checkbox", { name: "Property address confirmed" });
    await first.check();
    await expect(page.getByText(/1 of 9 done/)).toBeVisible();

    await page.getByRole("link", { name: /^Dates/ }).click();
    await page.getByRole("button", { name: "Add date" }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Title").fill("UD trial");
    await dlg.getByLabel("Date", { exact: true }).fill("2026-12-01");
    await dlg.getByLabel("Time", { exact: true }).fill("08:30");
    await dlg.getByRole("button", { name: "Save" }).click();
    await toast(page, "Date added");
    await expect(page.getByText("UD trial")).toBeVisible();

    // UD calculator: 30-day notice served personally on 9/9/26 → earliest filing Tue 10/13 (10/12 is a court holiday)
    await page.getByLabel("Served on", { exact: true }).fill("2026-09-09");
    await expect(page.getByText("Fri, Oct 9, 2026").first()).toBeVisible();
    await expect(page.getByText("Tue, Oct 13, 2026").first()).toBeVisible();
    await page.screenshot({ path: "test-results/screens/matter-dates.png", fullPage: true });

    await page.getByRole("link", { name: /^Billing/ }).click();
    await page.getByRole("button", { name: "Add entry" }).click();
    await page.getByRole("dialog").getByLabel("Amount").fill("250");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await toast(page, "Payment recorded");
    await expect(page.getByText("$750.00").first()).toBeVisible();

    await page.getByRole("link", { name: /^Timeline/ }).click();
    await expect(page.getByText(/Stage: Intake → Notice Served/)).toBeVisible();
    await expect(page.getByText(/Payment: \$250\.00/)).toBeVisible();
  });

  test("Global search and conflict check", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search by name, phone/).fill("Hernandez");
    await expect(page.getByRole("option", { name: /Hernández, María José/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/conflicts");
    await page.getByPlaceholder("Prospective client's full name").fill("Kevin Marsch");
    await page.getByRole("button", { name: "Run check" }).click();
    await expect(page.getByRole("link", { name: "Marsh, Kevin" })).toBeVisible();
  });

  test("Board view and Spanish toggle", async ({ page }) => {
    await page.goto("/matters?area=ud&view=board");
    await expect(page.getByText("Complaint Filed")).toBeVisible();
    await page.screenshot({ path: "test-results/screens/board.png", fullPage: true });

    await page.goto(matterUrl);
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: "Español" }).click();
    await expect(page.getByRole("link", { name: "Resumen" })).toBeVisible();
    await expect(page.getByText("Lista de admisión")).toBeVisible();
    await page.screenshot({ path: "test-results/screens/matter-es.png", fullPage: true });
    await page.getByRole("button", { name: "Cuenta" }).click();
    await page.getByRole("menuitem", { name: "English" }).click();
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
  });

  test("Works on a phone-sized screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Matters" }).click();
    await expect(page.getByRole("heading", { name: "Matters" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/screens/mobile-matters.png", fullPage: true });
  });
});

test.describe.serial("Saved intake and generator", () => {
  test("saves an accented-name draft, detects a stale editor, and resumes it", async ({ page, context }) => {
    await page.goto("/matters/new");
    await page.getByLabel("First name").fill("José");
    await page.getByLabel("Last name(s)").fill("Muñoz García Draft");
    await page.getByRole("button", { name: "Save intake draft" }).click();
    await page.waitForURL(/\/matters\/new\?draft=/);
    const draftUrl = page.url();
    const other = await context.newPage();
    await other.goto(draftUrl);
    await page.getByLabel("Phone", { exact: true }).fill("3105550181");
    await page.getByRole("button", { name: "Save intake draft" }).click();
    await toast(page, "Intake draft saved");
    await other.getByLabel("Phone", { exact: true }).fill("3105550182");
    await other.getByRole("button", { name: "Save intake draft" }).click();
    await toast(other, /This intake changed/);
    await expect(other.getByLabel("Phone", { exact: true })).toHaveValue("3105550182");
    await other.close();
    await page.goto("/intake-drafts");
    await page.getByRole("link", { name: "José Muñoz García Draft" }).click();
    await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("3105550181");
    await page.getByRole("button", { name: "Cambiar a español" }).click();
    await expect(page.getByRole("button", { name: "Guardar borrador de admisión" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Guardar borrador de admisión" })).toBeVisible();
    await page.getByRole("button", { name: "Switch to English" }).click();
  });
  test("shows a bilingual generator and disabled setup without losing intake access", async ({ page }) => {
    await page.goto("/case-generator");
    await expect(page.getByRole("heading", { name: "Case Generator" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create case folders", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Cambiar a español" }).click();
    await expect(page.getByRole("heading", { name: "Generador de casos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva admisión", exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Switch to English" }).click();
  });
});

test("completes intake and reads system history in Spanish", async ({ page }) => {
  await page.goto("/matters/new");
  await page.getByRole("button", { name: "Cambiar a español" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Lucía");
  await page.getByLabel("Apellido(s)").fill("García López");
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByRole("button", { name: /GEN General/ }).click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByLabel("Tarifa fija", { exact: true }).fill("200");
  await page.getByLabel("Pago recibido hoy").fill("50");
  await expect(page.getByRole("button", { name: "Efectivo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page.getByRole("button", { name: "Crear caso", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: /Revisé los nombres del cliente/ }).check();
  await page.screenshot({ path: "test-results/screens/intake-review-es.png", fullPage: true });
  await page.getByRole("button", { name: "Crear caso", exact: true }).click();
  await page.waitForURL(/\/matters\/[0-9a-f-]{36}$/);
  await page.goto(`${page.url()}?tab=timeline`);
  await expect(page.getByText(/Caso abierto \(CPH-/)).toBeVisible();
  await expect(page.getByText(/Pago recibido:.*50\.00.*Efectivo/)).toBeVisible();
  await page.getByRole("button", { name: "Switch to English" }).click();
});

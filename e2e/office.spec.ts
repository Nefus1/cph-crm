import { expect, test } from "@playwright/test";
test("follow-up creation, manual contact logging, and resolution", async ({ page }) => {
  await page.goto("/follow-ups");
  const english = page.getByRole("button", { name: "Switch to English" });
  if (await english.isVisible()) await english.click();
  await page.getByText("New follow-up", { exact: true }).click();
  const form = page.locator("form").first();
  await form.getByLabel("Title", { exact: true }).fill("Office follow-up test");
  const matter = await form.getByLabel("Matter", { exact: true }).inputValue();
  const option = await form.getByLabel("Matter", { exact: true }).locator("option:checked").textContent();
  const number = option!.split(" — ")[0];
  const contact = await form.getByLabel("Client / party").locator("option").all();
  for (const item of contact) {
    if ((await item.textContent())?.includes(number)) {
      await form.getByLabel("Client / party").selectOption((await item.getAttribute("value"))!);
      break;
    }
  }
  expect(matter).toBeTruthy();
  await form.getByLabel("Follow-up date", { exact: true }).fill("2026-11-12");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText("Saved");
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Office follow-up test", exact: true }) });
  await expect(card).toBeVisible();
  await card.getByText("Record contact attempt", { exact: true }).click();
  await card.getByLabel("Outcome", { exact: true }).selectOption("resolved");
  await card.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(card).toHaveCount(0);
});
test("paperwork saves and Spanish mobile navigation persists", async ({ page }) => {
  await page.goto("/paperwork");
  const english = page.getByRole("button", { name: "Switch to English" });
  if (await english.isVisible()) await english.click();
  await page.getByText("New paperwork item", { exact: true }).click();
  const form = page.locator("form").first();
  await form.getByLabel("Title", { exact: true }).fill("José — Pleading test");
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(form.getByRole("status")).toHaveText("Saved");
  await expect(page.locator("article").filter({ hasText: "José — Pleading test" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Cambiar a español" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentos");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentos");
  await page.getByRole("button", { name: "Switch to English" }).click();
});

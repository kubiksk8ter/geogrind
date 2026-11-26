import { expect, type Page, test } from "@playwright/test";

const BRNO = [
  [16.43, 49.1],
  [16.73, 49.3],
];

/** Answers the command endpoint like the server would, so no AI or geocoder is involved. */
async function answerCommands(page: Page, body: object) {
  const requests: unknown[] = [];
  await page.route("**/api/command", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: body });
  });
  return requests;
}

async function open(page: Page, locale = "en") {
  await page.goto(`/${locale}`);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
}

async function acknowledgeNotice(page: Page) {
  await page.getByRole("button", { name: "I understand" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("the page loads with the map", async ({ page }) => {
  await open(page);

  // The modal notice hides the rest of the page from the accessibility tree, so no role query.
  await expect(page.locator("h1")).toHaveText("GeoGrind");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("the start-up notice is shown on the first visit", async ({ page }) => {
  await open(page);

  await expect(
    page.getByRole("dialog", { name: "Welcome to GeoGrind" }),
  ).toBeVisible();
});

test("acknowledging the notice closes it and focuses the command input", async ({
  page,
}) => {
  await open(page);

  await acknowledgeNotice(page);

  await expect(page.getByLabel("Map command")).toBeFocused();
});

test("a command moves the map and pauses the input", async ({ page }) => {
  const requests = await answerCommands(page, {
    ok: true,
    result: { action: "zoom_to_place", bounds: BRNO },
    cooldownSeconds: 10,
  });
  await open(page);
  await acknowledgeNotice(page);

  const input = page.getByLabel("Map command");
  await input.fill("Zoom to Brno");
  await input.press("Enter");

  await expect(page.getByRole("status")).toContainText("The map has moved");
  await expect(input).toBeDisabled();
  expect(requests).toEqual([{ text: "Zoom to Brno", locale: "en" }]);
});

test("an unsupported command shows a message and the app keeps working", async ({
  page,
}) => {
  await answerCommands(page, {
    ok: false,
    error: { code: "unsupported", cooldownSeconds: 10 },
  });
  await open(page);
  await acknowledgeNotice(page);

  const input = page.getByLabel("Map command");
  await input.fill("Show cycling routes");
  await input.press("Enter");

  await expect(page.getByRole("status")).toContainText(
    "Only zooming to a place on the map is supported",
  );
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
});

test("the side panel opens and closes", async ({ page }) => {
  await open(page);
  await acknowledgeNotice(page);

  await page.getByRole("button", { name: "Open side panel" }).click();
  const panel = page.getByRole("dialog", { name: "Side panel" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("tab", { name: "History" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("the language switch changes the texts and the address", async ({
  page,
}) => {
  await open(page);
  await acknowledgeNotice(page);

  await page.getByRole("radio", { name: "Czech" }).click();

  await expect(page).toHaveURL(/\/cs$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await expect(page.getByLabel("Příkaz pro mapu")).toBeVisible();
});

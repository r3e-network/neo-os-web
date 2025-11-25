import { test, expect } from "@playwright/test";

const API = process.env.API_URL || "http://localhost:8080";
const TOKEN = process.env.API_TOKEN || "dev-token";
const TENANT = process.env.API_TENANT || "";

function qs(params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/?${search.toString()}`;
}

test("engine bus console sends event/data/compute", async ({ page }) => {
  await page.goto(qs({ api: API, token: TOKEN, tenant: TENANT }));
  await expect(page.getByText("Engine Bus Console")).toBeVisible();

  // Event
  await page.getByLabel("Mode").selectOption("events");
  await page.getByLabel("Event name").fill("observation");
  await page.getByLabel("Payload").fill('{"account_id":"acct","feed_id":"feed","price":"1"}');
  await page.getByRole("button", { name: "Send to bus" }).click();
  await expect(page.getByText("Response")).toBeVisible();

  // Data
  await page.getByLabel("Mode").selectOption("data");
  await page.getByLabel("Topic").fill("stream-1");
  await page.getByLabel("Payload").fill('{"price":123}');
  await page.getByRole("button", { name: "Send to bus" }).click();
  await expect(page.getByText("Response")).toBeVisible();

  // Compute
  await page.getByLabel("Mode").selectOption("compute");
  await page.getByLabel("Payload").fill('{"function_id":"fn","account_id":"acct","input":{"foo":"bar"}}');
  await page.getByRole("button", { name: "Send to bus" }).click();
  await expect(page.getByText("Response")).toBeVisible();
});

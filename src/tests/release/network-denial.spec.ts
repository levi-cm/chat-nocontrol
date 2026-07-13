import { expect, test, type Page } from "@playwright/test";
import { encryptFile } from "../../crypto/file";
import {
  createSenderSigningCapability,
  deriveIdentityFromEntropy,
} from "../../crypto/identity";
import { createPublicContact } from "../../protocol/ppxc";
import { encodeEncryptedFileObject } from "../../protocol/ppxf";
import { importSessionIdentity } from "../e2e/helpers";

const PREVIEW_ORIGIN = "http://127.0.0.1:4173";

function allowedStaticPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    /^\/workbox-[a-z0-9]+\.js$/u.test(pathname)
  );
}

function isAllowedRequest(rawUrl: string, method: string): boolean {
  const url = new URL(rawUrl);
  return (
    url.origin === PREVIEW_ORIGIN &&
    method === "GET" &&
    allowedStaticPath(url.pathname)
  );
}

async function installNetworkDenial(page: Page): Promise<string[]> {
  const denied: string[] = [];
  page.on("websocket", (socket) => denied.push(`WEBSOCKET ${socket.url()}`));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!isAllowedRequest(url.href, request.method())) {
      denied.push(`${request.method()} ${url.href}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return denied;
}

test("core shell makes no external network requests", async ({ page }) => {
  const denied = await installNetworkDenial(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByRole("button", { name: "Scan with camera" }).click();
  await expect(page.getByText("Camera scanning is unavailable.")).toBeVisible();
  await page.reload();
  await importSessionIdentity(page, {
    entropy: new Uint8Array(32),
    pseudonym: "Alice",
  });
  for (const name of ["Encrypt", "Decrypt", "Contacts", "Identity", "Help"]) {
    await page.getByRole("link", { name }).click();
  }
  await page.getByLabel("Language").selectOption("de");
  for (const name of [
    "Verschlüsseln",
    "Entschlüsseln",
    "Kontakte",
    "Identität",
    "Hilfe",
  ]) {
    await page.getByRole("link", { name }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Hilfe", exact: true }),
  ).toBeVisible();
  expect(denied).toEqual([]);
});

test("network harness denies API-like, non-GET, other-port, and external requests", async ({
  page,
}) => {
  const denied = await installNetworkDenial(page);
  await page.goto("/");
  await page.evaluate(async () => {
    await Promise.allSettled([
      fetch("/api/telemetry", { method: "POST", body: "no" }),
    ]);
  });
  expect(denied).toEqual(["POST http://127.0.0.1:4173/api/telemetry"]);
  expect(isAllowedRequest("http://127.0.0.1:9999/probe", "GET")).toBe(false);
  expect(isAllowedRequest("https://example.invalid/probe", "GET")).toBe(false);
  expect(isAllowedRequest("http://127.0.0.1:4173/api/telemetry", "GET")).toBe(
    false,
  );
});

test("validated hostile playlist content stays download-only and never fetches", async ({
  page,
}) => {
  const denied = await installNetworkDenial(page);
  const alice = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(41),
    "Alice",
  );
  const bobEntropy = new Uint8Array(32).fill(42);
  const bob = await deriveIdentityFromEntropy(bobEntropy, "Bob");
  const playlist = "#EXTM3U\nhttps://attacker.invalid/tracker.ts\n";
  const encrypted = await encryptFile({
    sender: createPublicContact(alice, "Alice", 1n),
    senderSigningCapability: createSenderSigningCapability(alice),
    recipient: createPublicContact(bob, "Bob", 2n),
    file: new Blob([playlist]),
    filename: "hostile.m3u8",
    mimeHint: "application/vnd.apple.mpegurl",
    caption: "",
    fileLength: BigInt(new TextEncoder().encode(playlist).byteLength),
  });

  await page.goto("/");
  await importSessionIdentity(page, { entropy: bobEntropy, pseudonym: "Bob" });
  await page.getByRole("link", { name: "Decrypt" }).click();
  await page.getByLabel("Encrypted file").setInputFiles({
    name: "hostile.ppxfile",
    mimeType: "application/x-ppx-file",
    buffer: Buffer.from(encodeEncryptedFileObject(encrypted)),
  });
  await page.getByRole("button", { name: "Decrypt locally" }).click();
  await expect(page.getByText(/No safe inline preview/u)).toBeVisible();
  await expect(page.locator("audio, video, img.file-preview")).toHaveCount(0);
  expect(denied).toEqual([]);
});

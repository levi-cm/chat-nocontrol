import { expect, test } from "@playwright/test";
import { deriveIdentityFromEntropy } from "../../crypto/identity";
import {
  createPublicContact,
  encodePublicContactQr,
} from "../../protocol/ppxc";

test("denied IndexedDB falls back to usable session-only mode", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Alice");
  await page
    .getByLabel("24 recovery words")
    .fill(`${"abandon ".repeat(23)}art`);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.getByRole("link", { name: "Identity" }).click();
  await expect(
    page.getByRole("heading", { name: "Public contact" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Create identity or import identity" }),
  ).toBeVisible();
});

test("chosen session-only mode does not persist new contacts", async ({
  page,
}) => {
  const contactIdentity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(4),
    "Session Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(contactIdentity, "Session Bob", 4n),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Session Alice");
  await page
    .getByLabel("24 recovery words")
    .fill(`${"abandon ".repeat(23)}art`);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await page.getByRole("link", { name: "Contacts" }).click();
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("Session Bob", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByText("Session Bob", { exact: true })).toHaveCount(0);
});

test("choosing session-only clears contacts that existed in IndexedDB", async ({
  page,
}) => {
  const contactIdentity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(5),
    "Persistent Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(contactIdentity, "Persistent Bob", 5n),
  );

  await page.goto("/#/contacts");
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("Persistent Bob", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Identity" }).click();
  await page.getByRole("button", { name: "Import identity" }).click();
  await page.getByLabel("Pseudonym").fill("Session Alice");
  await page
    .getByLabel("24 recovery words")
    .fill(`${"abandon ".repeat(23)}art`);
  await page.getByRole("button", { name: "Import recovery words" }).click();
  await page.getByRole("button", { name: "No, use session only" }).click();
  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.reload();
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByText("Persistent Bob", { exact: true })).toHaveCount(
    0,
  );
});

test("chosen session-only mode does not persist locale settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open settings" }).click();
  await page.getByLabel("Language").selectOption("de");
  await page.getByRole("link", { name: "Chat NoControl" }).click();
  await page.getByRole("button", { name: "Identität importieren" }).click();
  await page.getByLabel("Pseudonym").fill("Session Alice");
  await page
    .getByLabel("24 Wiederherstellungswörter")
    .fill(`${"abandon ".repeat(23)}art`);
  await page
    .getByRole("button", { name: "Wiederherstellungswörter importieren" })
    .click();
  await page
    .getByRole("button", { name: "Nein, nur für diese Sitzung verwenden" })
    .click();
  await expect(page).toHaveURL(/#\/encrypt$/u);
  await page.reload();
  await page.getByRole("link", { name: "Open settings" }).click();
  await expect(page.getByLabel("Language")).toHaveValue("en");
});

test("runtime IndexedDB write failure falls back without losing the session", async ({
  page,
}) => {
  const contactIdentity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(6),
    "Runtime Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(contactIdentity, "Runtime Bob", 6n),
  );
  await page.addInitScript(() => {
    // The wrapper must preserve the runtime IDBDatabase receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBDatabase.prototype.transaction;
    Object.defineProperty(window, "__failPpxWrites", {
      configurable: true,
      writable: true,
      value: false,
    });
    IDBDatabase.prototype.transaction = function (...args) {
      if (
        (window as typeof window & { __failPpxWrites: boolean })
          .__failPpxWrites &&
        args[1] === "readwrite"
      ) {
        throw new DOMException("runtime failure", "InvalidStateError");
      }
      return original.apply(this, args);
    };
  });
  await page.goto("/#/contacts");
  await page.evaluate(() => {
    (window as typeof window & { __failPpxWrites: boolean }).__failPpxWrites =
      true;
  });
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await expect(page.getByText("Runtime Bob", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "This session continues in memory",
  );
});

test("runtime erase failure never falsely claims persistent deletion", async ({
  page,
}) => {
  const contactIdentity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(7),
    "Retained Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(contactIdentity, "Retained Bob", 7n),
  );
  await page.addInitScript(() => {
    // The wrapper must preserve the runtime IDBDatabase receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBDatabase.prototype.transaction;
    Object.defineProperty(window, "__failPpxWrites", {
      configurable: true,
      writable: true,
      value: false,
    });
    IDBDatabase.prototype.transaction = function (...args) {
      if (
        (window as typeof window & { __failPpxWrites: boolean })
          .__failPpxWrites &&
        args[1] === "readwrite"
      ) {
        throw new DOMException("runtime failure", "InvalidStateError");
      }
      return original.apply(this, args);
    };
  });
  await page.goto("/#/contacts");
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.getByRole("link", { name: "Identity" }).click();
  await page.evaluate(() => {
    (window as typeof window & { __failPpxWrites: boolean }).__failPpxWrites =
      true;
  });
  await page.getByRole("button", { name: "Erase everything" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "deletion could not be confirmed",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByText("Retained Bob", { exact: true })).toBeVisible();
});

test("a successful erase closes confirmation and removes local data", async ({
  page,
}) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(10),
    "Erase Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(identity, "Erase Bob", 10n),
  );
  await page.goto("/#/contacts");
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.getByRole("link", { name: "Identity" }).click();
  await page.getByRole("button", { name: "Erase everything" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByText("Erase Bob", { exact: true })).toHaveCount(0);
});

test("locale deletion failure keeps confirmation open after data is erased", async ({
  page,
}) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(14),
    "Locale Erase Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(identity, "Locale Erase Bob", 14n),
  );
  await page.goto("/#/contacts");
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.getByRole("link", { name: "Identity" }).click();
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (key === "ppx-locale") {
        throw new DOMException("locale removal denied", "SecurityError");
      }
      return original.call(this, key);
    };
  });
  await page.getByRole("button", { name: "Erase everything" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "deletion could not be confirmed",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByText("Locale Erase Bob", { exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.getByText("Locale Erase Bob", { exact: true })).toHaveCount(
    0,
  );
});

test("contact deletion failure keeps the contact and confirmation truthful", async ({
  page,
}) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(11),
    "Delete Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(identity, "Delete Bob", 11n),
  );
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBDatabase.prototype.transaction;
    Object.defineProperty(window, "__failPpxWrites", {
      configurable: true,
      writable: true,
      value: false,
    });
    IDBDatabase.prototype.transaction = function (...args) {
      if (
        (window as typeof window & { __failPpxWrites: boolean })
          .__failPpxWrites &&
        args[1] === "readwrite"
      ) {
        throw new DOMException("runtime failure", "InvalidStateError");
      }
      return original.apply(this, args);
    };
  });
  await page.goto("/#/contacts");
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.evaluate(() => {
    (window as typeof window & { __failPpxWrites: boolean }).__failPpxWrites =
      true;
  });
  await page.getByRole("button", { name: "Delete contact Delete Bob" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "deletion could not be confirmed",
  );
  await expect(page.getByText("Delete Bob", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Delete Bob", { exact: true })).toBeVisible();
});

test("one failed persistent read preserves the other loaded store in session", async ({
  page,
}) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(12),
    "Partial Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(identity, "Partial Bob", 12n),
  );
  await page.goto("/#/contacts");
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[0] === "vaults" && args[1] !== "readwrite") {
        throw new DOMException("vault read failed", "InvalidStateError");
      }
      return original.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.getByText("Partial Bob", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "This session continues in memory",
  );
});

test("erase after a partial read failure removes the retained persistent data", async ({
  page,
}) => {
  const identity = await deriveIdentityFromEntropy(
    new Uint8Array(32).fill(13),
    "Partial Erase Bob",
  );
  const contactQr = encodePublicContactQr(
    createPublicContact(identity, "Partial Erase Bob", 13n),
  );
  await page.goto("/#/contacts");
  await page.getByLabel("Public contact payload").fill(contactQr);
  await page.getByRole("button", { name: "Save public contact" }).click();
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[0] === "vaults" && args[1] !== "readwrite") {
        throw new DOMException("vault read failed", "InvalidStateError");
      }
      return original.apply(this, args);
    };
  });
  await page.reload();
  await expect(
    page.getByText("Partial Erase Bob", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Identity" }).click();
  await page.getByRole("button", { name: "Erase everything" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Contacts" }).click();
  await expect(
    page.getByText("Partial Erase Bob", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Partial Erase Bob", { exact: true }),
  ).toHaveCount(0);
});

test("mutating flows wait until IndexedDB startup resolves", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBRequest.prototype.addEventListener;
    IDBRequest.prototype.addEventListener = function (
      type: string,
      callback: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === "success" && this instanceof IDBOpenDBRequest) {
        const delayed: EventListener = (event) => {
          window.setTimeout(() => {
            if (typeof callback === "function") callback.call(this, event);
            else callback.handleEvent(event);
          }, 200);
        };
        return original.call(this, type, delayed, options);
      }
      return original.call(this, type, callback, options);
    };
  });
  await page.goto("/#/contacts");
  await expect(
    page.getByRole("heading", { name: "Loading local storage..." }),
  ).toBeVisible();
  await expect(page.getByLabel("Public contact payload")).toHaveCount(0);
  await expect(page.getByLabel("Public contact payload")).toBeVisible();
});

import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { IdentityCreate } from "../flows/identity/create";
import { ContactsManage } from "../flows/contacts/manage";
import { DecryptFlow } from "../flows/decrypt";
import { EncryptTextFlow } from "../flows/encrypt/text";
import { HelpFlow } from "../flows/help";
import { ConfirmationDialog } from "../components/dialogs/confirmation";
import { PrivateExportCard } from "../components/cards/private-export-card";
import { TextField } from "../components/forms/text-field";
import type { ManagedContact } from "../components/cards/contact-management-card";
import { defaultCryptoProvider } from "../crypto/default-provider";
import { zeroizeIdentitySecrets } from "../crypto/zeroize";
import { messages, type Locale, type MessageKey } from "../i18n";
import type {
  DerivedIdentity,
  LockedVaultObject,
  PublicContact,
} from "../protocol/types";
import { encodeBase45Upper } from "../protocol/base45";
import { encodePublicContact } from "../protocol/ppxc";
import { encodeLockedVault } from "../protocol/ppxv";
import { listContacts, replaceContacts } from "../storage/contacts";
import {
  createStorageContext,
  type PpxDatabase,
  type StorageContext,
} from "../storage/db";
import { deleteAllLocalData } from "../storage/erase";
import { deleteVault, getVault, putVault } from "../storage/vault";
import { deleteSettings, getSettings, putSettings } from "../storage/settings";
import { SessionStorage } from "../storage/session";
import {
  type CryptoWorkerJob,
  startUnlockVaultJob,
} from "../workers/crypto-client";
import {
  clearStoredLocale,
  dismissUpdateAvailable,
  isUpdateAvailable,
  readStoredLocale,
} from "./bootstrap";
import { AUTO_LOCK_ACTIVITY_EVENTS, AUTO_LOCK_MS } from "./auto-lock";
import { ROUTES, routeFromHash, type RouteName } from "./routes";

const navItems: { route: RouteName; key: MessageKey; mark: string }[] = [
  { route: "encrypt", key: "navEncrypt", mark: "E" },
  { route: "decrypt", key: "navDecrypt", mark: "D" },
  { route: "contacts", key: "navContacts", mark: "C" },
  { route: "identity", key: "navIdentity", mark: "I" },
  { route: "help", key: "navHelp", mark: "?" },
];

function canonicalContacts(
  records: ReadonlyArray<ManagedContact>,
): ManagedContact[] {
  const valid: ManagedContact[] = [];
  for (const record of records) {
    try {
      valid.push({
        contact: defaultCryptoProvider.parsePublicContact(
          encodePublicContact(record.contact),
        ),
        nickname: typeof record.nickname === "string" ? record.nickname : "",
      });
    } catch {
      // IndexedDB is untrusted input; discard non-canonical or corrupted rows.
    }
  }
  return valid;
}

export function App() {
  const [locale, setLocale] = useState<Locale>(readStoredLocale);
  const [route, setRoute] = useState<RouteName>(() =>
    routeFromHash(window.location.hash),
  );
  const [activeIdentity, setActiveIdentity] = useState<DerivedIdentity | null>(
    null,
  );
  const [publicContact, setPublicContact] = useState<PublicContact | null>(
    null,
  );
  const [contacts, setContacts] = useState<ManagedContact[]>([]);
  const [storage, setStorage] = useState<StorageContext | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storedVault, setStoredVault] = useState<LockedVaultObject | null>(
    null,
  );
  const [sessionOnly, setSessionOnly] = useState(false);
  const sessionMemory = useRef(new SessionStorage());
  const degradedPersistentDb = useRef<PpxDatabase | null>(null);
  const suppressNextLocalePersistence = useRef(false);
  const [updateAvailable, setUpdateAvailable] = useState(isUpdateAvailable);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [storageFailure, setStorageFailure] = useState<
    "fallback" | "delete-failed" | null
  >(null);
  const t = (key: MessageKey) => messages[locale][key];

  const lockActiveIdentity = () => {
    if (activeIdentity) zeroizeIdentitySecrets(activeIdentity);
    setActiveIdentity(null);
    setPublicContact(null);
  };

  useEffect(
    () => () => {
      if (activeIdentity) zeroizeIdentitySecrets(activeIdentity);
    },
    [activeIdentity],
  );

  useEffect(() => {
    let cancelled = false;
    let opened: StorageContext | null = null;
    void createStorageContext().then(async (context) => {
      opened = context;
      if (cancelled) {
        if (context.mode === "persistent") context.db.close();
        return;
      }
      setStorage(context);
      if (context.mode === "persistent") {
        let loaded: ManagedContact[] = [];
        let loadedVault: LockedVaultObject | null = null;
        const [contactsResult, vaultResult, settingsResult] =
          await Promise.allSettled([
            listContacts(context.db),
            getVault(context.db),
            getSettings(context.db),
          ]);
        let loadedLocale: Locale = locale;
        let readFailed =
          contactsResult.status === "rejected" ||
          vaultResult.status === "rejected" ||
          settingsResult.status === "rejected";
        try {
          const savedContacts =
            contactsResult.status === "fulfilled" ? contactsResult.value : [];
          loaded = canonicalContacts(
            savedContacts.map(({ contact, nickname }) => ({
              contact,
              nickname,
            })),
          );
          loadedVault =
            vaultResult.status === "fulfilled"
              ? (vaultResult.value ?? null)
              : null;
          if (
            settingsResult.status === "fulfilled" &&
            settingsResult.value !== undefined
          ) {
            if (
              settingsResult.value.locale !== "en" &&
              settingsResult.value.locale !== "de"
            ) {
              readFailed = true;
            } else {
              loadedLocale = settingsResult.value.locale;
            }
          }
          if (loaded.length !== savedContacts.length) {
            await replaceContacts(context.db, loaded);
          }
        } catch {
          readFailed = true;
        }
        if (readFailed) {
          degradedPersistentDb.current = context.db;
          const session = sessionMemory.current;
          session.replaceContacts(loaded);
          session.setLocale(loadedLocale);
          if (loadedVault) session.putVault(loadedVault);
          if (!cancelled) {
            setStorage({ mode: "session-only", session });
            setContacts(loaded);
            setStoredVault(loadedVault);
            setLocale(loadedLocale);
            setSessionOnly(true);
            setStorageFailure("fallback");
            clearStoredLocale();
          }
        } else if (!cancelled) {
          setContacts(loaded);
          setStoredVault(loadedVault);
          setLocale(loadedLocale);
        }
      } else {
        context.session.setLocale(locale);
        setContacts(
          canonicalContacts(
            context.session
              .listContacts()
              .map(({ contact, nickname }) => ({ contact, nickname })),
          ),
        );
        setStoredVault(context.session.getVault() ?? null);
        setSessionOnly(true);
      }
      if (!cancelled) setStorageReady(true);
    });
    return () => {
      cancelled = true;
      if (opened?.mode === "persistent") opened.db.close();
    };
  }, []);

  useEffect(() => {
    const wentOffline = () => setOffline(true);
    const wentOnline = () => setOffline(false);
    window.addEventListener("offline", wentOffline);
    window.addEventListener("online", wentOnline);
    return () => {
      window.removeEventListener("offline", wentOffline);
      window.removeEventListener("online", wentOnline);
    };
  }, []);

  useLayoutEffect(() => {
    if (!activeIdentity) return;
    let timer = 0;
    let deadline = Date.now() + AUTO_LOCK_MS;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(
        lockActiveIdentity,
        Math.max(0, deadline - Date.now()),
      );
    };
    const recordActivity = () => {
      if (Date.now() >= deadline) {
        lockActiveIdentity();
        return;
      }
      deadline = Date.now() + AUTO_LOCK_MS;
      schedule();
    };
    const checkSuspendedTab = () => {
      if (document.visibilityState === "visible" && Date.now() >= deadline) {
        lockActiveIdentity();
      }
    };
    for (const event of AUTO_LOCK_ACTIVITY_EVENTS)
      window.addEventListener(event, recordActivity);
    document.addEventListener("visibilitychange", checkSuspendedTab);
    schedule();
    return () => {
      window.clearTimeout(timer);
      for (const event of AUTO_LOCK_ACTIVITY_EVENTS)
        window.removeEventListener(event, recordActivity);
      document.removeEventListener("visibilitychange", checkSuspendedTab);
    };
  }, [activeIdentity]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  useEffect(() => {
    const showUpdate = () => setUpdateAvailable(true);
    window.addEventListener("ppx-update-available", showUpdate);
    if (isUpdateAvailable()) setUpdateAvailable(true);
    return () => window.removeEventListener("ppx-update-available", showUpdate);
  }, []);

  const navigate = (next: RouteName) => {
    setRoute(next);
    if (window.location.hash !== ROUTES[next]) {
      window.location.hash = ROUTES[next];
    }
  };

  const fallBackToSession = (
    nextContacts: ManagedContact[],
    vault: LockedVaultObject | null,
  ) => {
    const session = sessionMemory.current;
    session.replaceContacts(nextContacts);
    session.setLocale(locale);
    if (vault) session.putVault(vault);
    else session.deleteVault();
    if (storage?.mode === "persistent") {
      degradedPersistentDb.current = storage.db;
    }
    setStorage({ mode: "session-only", session });
    setSessionOnly(true);
    setStorageFailure("fallback");
    clearStoredLocale();
  };

  useEffect(() => {
    if (!storageReady || !storage) return;
    if (suppressNextLocalePersistence.current) {
      suppressNextLocalePersistence.current = false;
      return;
    }
    if (sessionOnly || storage.mode !== "persistent") {
      const session =
        storage.mode === "session-only"
          ? storage.session
          : sessionMemory.current;
      session.setLocale(locale);
      clearStoredLocale();
      return;
    }
    let cancelled = false;
    void putSettings(storage.db, { locale })
      .then(() => {
        if (!cancelled && !clearStoredLocale()) {
          setStorageFailure("delete-failed");
        }
      })
      .catch(() => {
        if (!cancelled) fallBackToSession(contacts, storedVault);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, sessionOnly, storage, storageReady]);

  const saveContacts = async (next: ManagedContact[]): Promise<boolean> => {
    if (!storageReady || !storage) return false;
    const nextIds = new Set(
      next.map(({ contact }) =>
        [...contact.fingerprint]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join(""),
      ),
    );
    const destructive = contacts.some(
      ({ contact }) =>
        !nextIds.has(
          [...contact.fingerprint]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
        ),
    );
    if (!sessionOnly && storage.mode === "persistent") {
      try {
        await replaceContacts(storage.db, next);
      } catch {
        if (destructive) {
          setStorageFailure("delete-failed");
          return false;
        }
        fallBackToSession(next, storedVault);
      }
    } else {
      const session =
        storage.mode === "session-only"
          ? storage.session
          : sessionMemory.current;
      session.replaceContacts(next);
    }
    setContacts(next);
    return true;
  };

  const identityReady = async (
    identity: DerivedIdentity,
    contact: PublicContact,
    vault?: LockedVaultObject,
    existingRememberedVault = false,
    signal?: AbortSignal,
    acceptOwnership?: () => boolean,
  ) => {
    const aborted = () => signal?.aborted === true;
    if (aborted()) return;
    let persistenceFailed = false;
    let vaultPersisted = false;
    if (vault) {
      if (!sessionOnly && storage?.mode === "persistent") {
        try {
          await putVault(storage.db, vault);
          vaultPersisted = true;
          if (aborted()) {
            try {
              await deleteVault(storage.db);
            } catch {
              setStorageFailure("delete-failed");
            }
            return;
          }
        } catch {
          if (aborted()) return;
          persistenceFailed = true;
          fallBackToSession(contacts, vault);
        }
      } else if (storage?.mode === "session-only") {
        storage.session.putVault(vault);
      }
      if (aborted()) return;
      setStoredVault(vault);
    }
    const persistentIdentity =
      !persistenceFailed &&
      !sessionOnly &&
      storage?.mode === "persistent" &&
      (vaultPersisted || existingRememberedVault);
    setSessionOnly(!persistentIdentity);
    if (!persistentIdentity) {
      if (!persistenceFailed && storage?.mode === "persistent") {
        try {
          await Promise.all([
            replaceContacts(storage.db, []),
            deleteSettings(storage.db),
          ]);
          if (aborted()) return;
          clearStoredLocale();
        } catch {
          if (aborted()) return;
          fallBackToSession(contacts, vault ?? storedVault);
        }
      }
      const session =
        storage?.mode === "session-only"
          ? storage.session
          : sessionMemory.current;
      session.replaceContacts(contacts);
    }
    if (aborted()) return;
    if (acceptOwnership && !acceptOwnership()) return;
    setActiveIdentity(identity);
    setPublicContact(contact);
    navigate("encrypt");
  };

  const removeStoredVault = async (): Promise<boolean> => {
    const persistentDb =
      storage?.mode === "persistent"
        ? storage.db
        : degradedPersistentDb.current;
    if (persistentDb) {
      try {
        await deleteVault(persistentDb);
      } catch {
        fallBackToSession(contacts, storedVault);
        setStorageFailure("delete-failed");
        return false;
      }
    } else if (storage?.mode === "session-only") {
      storage.session.deleteVault();
    }
    setStoredVault(null);
    lockActiveIdentity();
    return true;
  };

  const eraseAll = async (): Promise<boolean> => {
    const persistentDb =
      storage?.mode === "persistent"
        ? storage.db
        : degradedPersistentDb.current;
    if (persistentDb) {
      try {
        await deleteAllLocalData(persistentDb);
      } catch {
        fallBackToSession(contacts, storedVault);
        setStorageFailure("delete-failed");
        return false;
      }
    } else if (storage?.mode === "session-only") {
      storage.session.eraseAll();
    }
    sessionMemory.current.eraseAll();
    if (storage?.mode !== "persistent" && degradedPersistentDb.current) {
      degradedPersistentDb.current.close();
      degradedPersistentDb.current = null;
    }
    const localeCleared = clearStoredLocale();
    if (locale !== "en") suppressNextLocalePersistence.current = true;
    setLocale("en");
    setContacts([]);
    setStoredVault(null);
    lockActiveIdentity();
    if (!localeCleared) {
      setStorageFailure("delete-failed");
      return false;
    }
    setStorageFailure(null);
    return true;
  };

  return (
    <div class="app-shell">
      <header class="topbar material">
        <a
          class="brand"
          href={ROUTES.identity}
          onClick={() => navigate("identity")}
        >
          <span class="brand-mark" aria-hidden="true">
            NC
          </span>
          <span>{t("brand")}</span>
        </a>
        <div class="topbar-actions">
          {activeIdentity && (
            <button
              class="button secondary compact-button"
              type="button"
              onClick={lockActiveIdentity}
            >
              {t("lockNow")}
            </button>
          )}
          <label class="locale-control">
            <span>{t("language")}</span>
            <select
              value={locale}
              onChange={(event) =>
                setLocale(event.currentTarget.value as Locale)
              }
            >
              <option value="en">{t("english")}</option>
              <option value="de">{t("german")}</option>
            </select>
          </label>
        </div>
      </header>

      <nav class="primary-nav material" aria-label={t("primaryNav")}>
        {navItems.map((item) => (
          <a
            href={ROUTES[item.route]}
            class={route === item.route ? "nav-link active" : "nav-link"}
            aria-current={route === item.route ? "page" : undefined}
            onClick={() => navigate(item.route)}
          >
            <span class="nav-mark" aria-hidden="true">
              {item.mark}
            </span>
            <span>{t(item.key)}</span>
          </a>
        ))}
      </nav>

      <div class="banner-stack">
        {updateAvailable && !activeIdentity && (
          <div class="update-banner" role="status">
            <span>{t("newerVersion")}</span>
            <button
              type="button"
              onClick={() => {
                dismissUpdateAvailable();
                setUpdateAvailable(false);
              }}
            >
              {t("reviewLater")}
            </button>
          </div>
        )}
        {offline && (
          <p class="offline-banner" role="status">
            {t("offlineState")}
          </p>
        )}
        {storageFailure && (
          <p class="offline-banner" role="alert">
            {t(
              storageFailure === "delete-failed"
                ? "deletionNotConfirmed"
                : "storageFallback",
            )}
          </p>
        )}
      </div>

      <main class="workspace" id="main-content">
        {!storageReady ? (
          <section class="flow-panel" aria-busy="true">
            <h1>{t("loadingStorage")}</h1>
          </section>
        ) : route === "help" ? (
          <HelpFlow
            t={t}
            locale={locale}
            storageMode={sessionOnly ? "session-only" : "persistent"}
          />
        ) : route === "encrypt" ? (
          <EncryptTextFlow
            key={activeIdentity ? "encrypt-unlocked" : "encrypt-locked"}
            t={t}
            identity={activeIdentity}
            sender={publicContact}
            contacts={contacts}
            locale={locale}
          />
        ) : route === "decrypt" ? (
          <DecryptFlow
            key={activeIdentity ? "decrypt-unlocked" : "decrypt-locked"}
            t={t}
            identity={activeIdentity}
            contacts={contacts}
            onContactsChange={saveContacts}
            locale={locale}
          />
        ) : route === "contacts" ? (
          <ContactsManage t={t} contacts={contacts} onChange={saveContacts} />
        ) : route === "identity" ? (
          <IdentityHome
            t={t}
            identity={activeIdentity}
            contact={publicContact}
            storedVault={storedVault}
            storageMode={storage?.mode ?? "session-only"}
            sessionOnly={sessionOnly}
            hasLocalData={storedVault !== null || contacts.length > 0}
            onReady={identityReady}
            onDeleteVault={removeStoredVault}
            onEraseAll={eraseAll}
          />
        ) : (
          <RoutePanel route={route} t={t} />
        )}
      </main>
    </div>
  );
}

function IdentityHome({
  t,
  identity,
  contact,
  storedVault,
  storageMode,
  sessionOnly,
  hasLocalData,
  onReady,
  onDeleteVault,
  onEraseAll,
}: {
  t: (key: MessageKey) => string;
  identity: DerivedIdentity | null;
  contact: PublicContact | null;
  storedVault: LockedVaultObject | null;
  storageMode: "persistent" | "session-only";
  sessionOnly: boolean;
  hasLocalData: boolean;
  onReady: (
    identity: DerivedIdentity,
    contact: PublicContact,
    vault?: LockedVaultObject,
    existingRememberedVault?: boolean,
    signal?: AbortSignal,
    acceptOwnership?: () => boolean,
  ) => Promise<void> | void;
  onDeleteVault: () => Promise<boolean>;
  onEraseAll: () => Promise<boolean>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const passphraseBytes = new TextEncoder().encode(passphrase).byteLength;
  const [unlockError, setUnlockError] = useState("");
  const [busy, setBusy] = useState(false);
  const unlockJob = useRef<CryptoWorkerJob<DerivedIdentity> | null>(null);
  const [confirming, setConfirming] = useState<"vault" | "all" | null>(null);

  const unlock = async () => {
    if (!storedVault) return;
    let operation: CryptoWorkerJob<DerivedIdentity> | null = null;
    let unlocked: DerivedIdentity | undefined;
    let transferred = false;
    setBusy(true);
    setUnlockError("");
    try {
      operation = startUnlockVaultJob({
        vault: storedVault,
        passphrase,
      });
      unlockJob.current = operation;
      unlocked = await operation.promise;
      if (unlockJob.current !== operation) {
        zeroizeIdentitySecrets(unlocked);
        unlocked = undefined;
        return;
      }
      await onReady(
        unlocked,
        defaultCryptoProvider.createPublicContact(
          unlocked,
          unlocked.pseudonym,
          unlocked.creationTime,
        ),
        undefined,
        true,
      );
      transferred = true;
      setPassphrase("");
    } catch {
      if (!operation || unlockJob.current === operation)
        setUnlockError(t("unlockError"));
    } finally {
      if (unlocked && !transferred) zeroizeIdentitySecrets(unlocked);
      if (!operation || unlockJob.current === operation) {
        unlockJob.current = null;
        setBusy(false);
      }
    }
  };

  useEffect(
    () => () => {
      unlockJob.current?.cancel();
      unlockJob.current = null;
    },
    [],
  );

  if (!identity && storedVault) {
    return (
      <section class="flow-panel">
        <h1>{t("unlockRemembered")}</h1>
        <TextField
          id="unlock-vault-passphrase"
          label={t("passphrase")}
          type="password"
          value={passphrase}
          onInput={setPassphrase}
        />
        <p class="input-meta">{t("passphraseHint")}</p>
        {passphrase !== "" &&
          (passphraseBytes < 12 || passphraseBytes > 256) && (
            <p class="field-error" role="alert">
              {t("passphraseError")}
            </p>
          )}
        {unlockError && (
          <p class="field-error" role="alert">
            {unlockError}
          </p>
        )}
        <div class="action-row">
          <button
            class="button primary"
            type="button"
            disabled={busy || passphraseBytes < 12 || passphraseBytes > 256}
            onClick={() => void unlock()}
          >
            {t("unlockIdentity")}
          </button>
          <button
            class="button danger-button"
            type="button"
            disabled={busy}
            onClick={() => setConfirming("vault")}
          >
            {t("deleteVault")}
          </button>
        </div>
        {confirming === "vault" && (
          <ConfirmationDialog
            t={t}
            title={t("deleteVault")}
            body={t("deleteVaultConfirm")}
            onCancel={() => setConfirming(null)}
            onConfirm={() =>
              void onDeleteVault().then((deleted) => {
                if (deleted) setConfirming(null);
              })
            }
          />
        )}
      </section>
    );
  }

  const encodedVault = storedVault ? encodeLockedVault(storedVault) : null;

  return (
    <div class="identity-layout">
      <IdentityCreate
        key={identity ? "identity-unlocked" : "identity-locked"}
        t={t}
        identity={identity}
        contact={contact}
        onReady={(
          readyIdentity,
          readyContact,
          vault,
          signal,
          acceptOwnership,
        ) =>
          onReady(
            readyIdentity,
            readyContact,
            vault,
            false,
            signal,
            acceptOwnership,
          )
        }
      />
      {identity && sessionOnly && (
        <p class="session-note" role="status">
          <strong>{t("sessionOnlyTitle")}</strong>{" "}
          {storageMode === "session-only"
            ? t("storageUnavailable")
            : t("sessionOnlyText")}
        </p>
      )}
      {encodedVault && identity && (
        <PrivateExportCard
          title={t("vaultTitle")}
          warning={t("vaultWarning")}
          qrText={`PPX1:PRIVATE:${encodeBase45Upper(encodedVault)}`}
          authorityLabel={t("privateAuthority")}
          qrLabel={t("vaultQrAlt")}
          formatHint={t("vaultHint")}
          fileBytes={encodedVault}
          downloadLabel={t("downloadVault")}
        />
      )}
      {hasLocalData && (
        <div class="local-data-actions">
          {storedVault && identity && (
            <button
              class="button danger-button"
              type="button"
              onClick={() => setConfirming("vault")}
            >
              {t("deleteVault")}
            </button>
          )}
          <button
            class="button danger-button"
            type="button"
            onClick={() => setConfirming("all")}
          >
            {t("eraseAll")}
          </button>
        </div>
      )}
      {confirming && (
        <ConfirmationDialog
          t={t}
          title={confirming === "vault" ? t("deleteVault") : t("eraseAll")}
          body={
            confirming === "vault"
              ? t("deleteVaultConfirm")
              : t("eraseAllConfirm")
          }
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const action = confirming === "vault" ? onDeleteVault : onEraseAll;
            void action().then((deleted) => {
              if (deleted) setConfirming(null);
            });
          }}
        />
      )}
    </div>
  );
}

const routeContent: Record<
  Exclude<RouteName, "identity">,
  [MessageKey, MessageKey]
> = {
  encrypt: ["encryptTitle", "encryptBody"],
  decrypt: ["decryptTitle", "decryptBody"],
  contacts: ["contactsTitle", "contactsBody"],
  help: ["helpTitle", "helpBody"],
};

function RoutePanel({
  route,
  t,
}: {
  route: Exclude<RouteName, "identity">;
  t: (key: MessageKey) => string;
}) {
  const [title, body] = routeContent[route];
  return (
    <section class="route-panel">
      <h1>{t(title)}</h1>
      <p class="lead">{t(body)}</p>
      {route === "help" && (
        <>
          <ul class="fact-list">
            <li>{t("noBackend")}</li>
            <li>{t("noTelemetry")}</li>
            <li>{t("noHistory")}</li>
          </ul>
          <p class="beta-warning" role="note">
            {t("betaWarning")}
          </p>
        </>
      )}
    </section>
  );
}

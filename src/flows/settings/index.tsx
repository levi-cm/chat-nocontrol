import type { Locale, MessageKey } from "../../i18n";
import type {
  AccentPreference,
  MessageOutputMode,
  QrExportMode,
  QrImportControls,
  ThemePreference,
} from "../../storage/settings";

const accents: Array<[AccentPreference, MessageKey]> = [
  ["blue", "accentBlue"],
  ["indigo", "accentIndigo"],
  ["purple", "accentPurple"],
  ["teal", "accentTeal"],
  ["pink", "accentPink"],
  ["orange", "accentOrange"],
  ["graphite", "accentGraphite"],
];

export function SettingsFlow({
  t,
  locale,
  theme,
  accent,
  translucent,
  messageQrCreationEnabled,
  qrExportMode,
  qrImportControls,
  messageOutputMode,
  autoDecryptIncomingMessages,
  onLocaleChange,
  onThemeChange,
  onAccentChange,
  onTranslucentChange,
  onMessageQrCreationEnabledChange,
  onQrExportModeChange,
  onQrImportControlsChange,
  onMessageOutputModeChange,
  onAutoDecryptIncomingMessagesChange,
}: {
  t: (key: MessageKey) => string;
  locale: Locale;
  theme: ThemePreference;
  accent: AccentPreference;
  translucent: boolean;
  messageQrCreationEnabled: boolean;
  qrExportMode: QrExportMode;
  qrImportControls: QrImportControls;
  messageOutputMode: MessageOutputMode;
  autoDecryptIncomingMessages: boolean;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemePreference) => void;
  onAccentChange: (accent: AccentPreference) => void;
  onTranslucentChange: (enabled: boolean) => void;
  onMessageQrCreationEnabledChange: (enabled: boolean) => void;
  onQrExportModeChange: (mode: QrExportMode) => void;
  onQrImportControlsChange: (controls: QrImportControls) => void;
  onMessageOutputModeChange: (mode: MessageOutputMode) => void;
  onAutoDecryptIncomingMessagesChange: (enabled: boolean) => void;
}) {
  return (
    <section class="flow-panel settings-flow">
      <div>
        <h1>{t("settingsTitle")}</h1>
        <p class="lead settings-lead">{t("settingsBody")}</p>
      </div>
      <div class="settings-group">
        <h2>{t("language")}</h2>
        <label class="setting-row" for="settings-language">
          <span>{t("language")}</span>
          <select
            id="settings-language"
            value={locale}
            onChange={(event) =>
              onLocaleChange(event.currentTarget.value as Locale)
            }
          >
            <option value="en">{t("english")}</option>
            <option value="de">{t("german")}</option>
          </select>
        </label>
      </div>
      <div class="settings-group">
        <h2>{t("appearance")}</h2>
        <label class="setting-row" for="settings-theme">
          <span>{t("theme")}</span>
          <select
            id="settings-theme"
            value={theme}
            onChange={(event) =>
              onThemeChange(event.currentTarget.value as ThemePreference)
            }
          >
            <option value="system">{t("themeSystem")}</option>
            <option value="light">{t("themeLight")}</option>
            <option value="dark">{t("themeDark")}</option>
          </select>
        </label>
        <label class="setting-row" for="settings-accent">
          <span>{t("accentColor")}</span>
          <span class="accent-control">
            <span class="accent-preview" aria-hidden="true" />
            <select
              id="settings-accent"
              value={accent}
              onChange={(event) =>
                onAccentChange(event.currentTarget.value as AccentPreference)
              }
            >
              {accents.map(([value, key]) => (
                <option value={value}>{t(key)}</option>
              ))}
            </select>
          </span>
        </label>
        <label class="setting-toggle" for="settings-translucency">
          <span>
            <strong>{t("translucentEffects")}</strong>
            <small>{t("translucentEffectsHint")}</small>
          </span>
          <input
            id="settings-translucency"
            type="checkbox"
            checked={translucent}
            onChange={(event) =>
              onTranslucentChange(event.currentTarget.checked)
            }
          />
        </label>
      </div>
      <div class="settings-group">
        <h2>{t("messageDeliverySettings")}</h2>
        <label class="setting-row" for="settings-message-output">
          <span>{t("messageOutputSetting")}</span>
          <select
            id="settings-message-output"
            value={messageOutputMode}
            onChange={(event) =>
              onMessageOutputModeChange(
                event.currentTarget.value as MessageOutputMode,
              )
            }
          >
            <option value="link">{t("messageOutputLink")}</option>
            <option value="text">{t("messageOutputText")}</option>
            <option value="both">{t("messageOutputBoth")}</option>
          </select>
        </label>
        <label class="setting-toggle" for="settings-auto-decrypt-incoming">
          <span>
            <strong>{t("autoDecryptIncomingMessages")}</strong>
            <small>{t("autoDecryptIncomingMessagesHint")}</small>
          </span>
          <input
            id="settings-auto-decrypt-incoming"
            type="checkbox"
            checked={autoDecryptIncomingMessages}
            onChange={(event) =>
              onAutoDecryptIncomingMessagesChange(event.currentTarget.checked)
            }
          />
        </label>
      </div>
      <div class="settings-group">
        <h2>{t("messageQrSettings")}</h2>
        <label class="setting-toggle" for="settings-message-qr-creation">
          <span>
            <strong>{t("messageQrCreationEnabled")}</strong>
            <small>{t("messageQrCreationEnabledHint")}</small>
          </span>
          <input
            id="settings-message-qr-creation"
            type="checkbox"
            checked={messageQrCreationEnabled}
            onChange={(event) =>
              onMessageQrCreationEnabledChange(event.currentTarget.checked)
            }
          />
        </label>
        {messageQrCreationEnabled && (
          <label class="setting-row" for="settings-qr-export">
            <span>{t("qrExportSetting")}</span>
            <select
              id="settings-qr-export"
              value={qrExportMode}
              onChange={(event) =>
                onQrExportModeChange(event.currentTarget.value as QrExportMode)
              }
            >
              <option value="app">{t("qrExportApp")}</option>
              <option value="link">{t("qrExportLink")}</option>
              <option value="both">{t("qrShowBoth")}</option>
            </select>
          </label>
        )}
        <label class="setting-row" for="settings-qr-import">
          <span>{t("qrImportSetting")}</span>
          <select
            id="settings-qr-import"
            value={qrImportControls}
            onChange={(event) =>
              onQrImportControlsChange(
                event.currentTarget.value as QrImportControls,
              )
            }
          >
            <option value="camera">{t("qrImportCamera")}</option>
            <option value="image">{t("qrImportImage")}</option>
            <option value="both">{t("qrShowBoth")}</option>
          </select>
        </label>
      </div>
    </section>
  );
}

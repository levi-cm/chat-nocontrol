import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsFlow } from "../../flows/settings";
import { messages, type MessageKey } from "../../i18n";

describe("message delivery settings", () => {
  afterEach(cleanup);

  it("shows Both and incoming auto-decrypt defaults and reports changes", async () => {
    const user = userEvent.setup();
    const onMessageOutputModeChange = vi.fn();
    const onAutoDecryptIncomingMessagesChange = vi.fn();
    const t = (key: MessageKey) => messages.en[key];

    render(
      <SettingsFlow
        t={t}
        locale="en"
        theme="system"
        accent="blue"
        translucent={true}
        messageQrCreationEnabled={false}
        qrExportMode="both"
        qrImportControls="both"
        messageOutputMode="both"
        autoDecryptIncomingMessages={true}
        onLocaleChange={vi.fn()}
        onThemeChange={vi.fn()}
        onAccentChange={vi.fn()}
        onTranslucentChange={vi.fn()}
        onMessageQrCreationEnabledChange={vi.fn()}
        onQrExportModeChange={vi.fn()}
        onQrImportControlsChange={vi.fn()}
        onMessageOutputModeChange={onMessageOutputModeChange}
        onAutoDecryptIncomingMessagesChange={
          onAutoDecryptIncomingMessagesChange
        }
      />,
    );

    const output = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Message output",
    });
    const autoDecrypt = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /^Auto-decrypt incoming message links and QRs/u,
    });
    expect(output.value).toBe("both");
    expect(autoDecrypt.checked).toBe(true);

    await user.selectOptions(output, "link");
    await user.click(autoDecrypt);
    expect(onMessageOutputModeChange).toHaveBeenCalledWith("link");
    expect(onAutoDecryptIncomingMessagesChange).toHaveBeenCalledWith(false);
  });

  it("provides equivalent German controls", () => {
    const t = (key: MessageKey) => messages.de[key];
    render(
      <SettingsFlow
        t={t}
        locale="de"
        theme="system"
        accent="blue"
        translucent={true}
        messageQrCreationEnabled={false}
        qrExportMode="both"
        qrImportControls="both"
        messageOutputMode="both"
        autoDecryptIncomingMessages={true}
        onLocaleChange={vi.fn()}
        onThemeChange={vi.fn()}
        onAccentChange={vi.fn()}
        onTranslucentChange={vi.fn()}
        onMessageQrCreationEnabledChange={vi.fn()}
        onQrExportModeChange={vi.fn()}
        onQrImportControlsChange={vi.fn()}
        onMessageOutputModeChange={vi.fn()}
        onAutoDecryptIncomingMessagesChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Nachrichtenausgabe")).not.toBeNull();
    expect(
      screen.getByRole("checkbox", {
        name: /^Eingehende Nachrichtenlinks und QRs automatisch entschlüsseln/u,
      }),
    ).not.toBeNull();
  });
});

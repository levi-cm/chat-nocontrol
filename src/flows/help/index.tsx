import { useState } from "preact/hooks";
import {
  CHAT_NOCONTROL_REPOSITORY_URL,
  CHAT_NOCONTROL_SECURITY_ADVISORY_URL,
} from "../../app/build-info";
import { downloadBlob } from "../../components/media/blob-url";
import {
  createDiagnosticsReport,
  formatDiagnosticsReport,
  type DiagnosticsReport,
} from "../../diagnostics/report";
import { buildIssueDraftUrl } from "../../diagnostics/issue-link";
import type { Locale, MessageKey } from "../../i18n";

export function HelpFlow({
  t,
  locale,
  storageMode,
}: {
  t: (key: MessageKey) => string;
  locale: Locale;
  storageMode: "persistent" | "session-only";
}) {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const reportText = report ? formatDiagnosticsReport(report) : "";
  const issueUrl = report
    ? buildIssueDraftUrl(report, CHAT_NOCONTROL_REPOSITORY_URL)
    : null;

  const downloadDraft = () => {
    downloadBlob(
      new Blob(
        [`# Chat NoControl diagnostics\n\n\`\`\`json\n${reportText}\n\`\`\`\n`],
        {
          type: "text/markdown",
        },
      ),
      "chat-nocontrol-issue-draft.md",
    );
  };

  return (
    <section class="flow-panel help-flow">
      <h1>{t("helpTitle")}</h1>
      <p class="lead">{t("helpBody")}</p>
      <ul class="fact-list">
        <li>{t("noBackend")}</li>
        <li>{t("noTelemetry")}</li>
        <li>{t("noHistory")}</li>
      </ul>
      <section class="about-panel">
        <h2>{t("aboutTitle")}</h2>
        <p>{t("aboutClaim")}</p>
        <ul class="fact-list">
          <li>{t("noForwardSecrecy")}</li>
          <li>{t("namesAreLabels")}</li>
          <li>{t("contentNotMetadata")}</li>
          <li>{t("noPasswordReset")}</li>
          <li>{t("identityLossWarning")}</li>
          <li>{t("exactSecurityClaim")}</li>
          <li>{t("securityNonclaims")}</li>
        </ul>
        <section aria-labelledby="chat-control-title">
          <h3 id="chat-control-title">{t("chatControlTitle")}</h3>
          <p>{t("chatControlBody")}</p>
        </section>
        <p>
          <a
            href={`${CHAT_NOCONTROL_REPOSITORY_URL}/blob/main/docs/chat-control-explainer.${locale}.md`}
            target="_blank"
            rel="noreferrer"
          >
            {t("readChatControlExplainer")}
          </a>
        </p>
        <details>
          <summary>{t("viewSourceBuild")}</summary>
          <p>
            {t("sourceBuildInfo")}{" "}
            <a
              href={CHAT_NOCONTROL_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
            >
              {CHAT_NOCONTROL_REPOSITORY_URL}
            </a>
          </p>
        </details>
      </section>
      <section>
        <h2>{t("diagnosticsTitle")}</h2>
        <p>{t("diagnosticsBody")}</p>
        <p>{t("privateSecurityReports")}</p>
        <p>
          <a
            href={CHAT_NOCONTROL_SECURITY_ADVISORY_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t("reportSecurityPrivately")}
          </a>
        </p>
        <button
          class="button secondary"
          type="button"
          onClick={() =>
            setReport(createDiagnosticsReport({ locale, storageMode }))
          }
        >
          {t("reportProblem")}
        </button>
        {report && (
          <div class="output-panel">
            <label for="diagnostics-report">{t("diagnosticsReview")}</label>
            <textarea
              class="field-control mono-output"
              id="diagnostics-report"
              rows={12}
              readOnly
              value={reportText}
            />
            {issueUrl ? (
              <a
                class="button secondary"
                href={issueUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("openIssueDraft")}
              </a>
            ) : (
              <>
                <button
                  class="button secondary"
                  type="button"
                  onClick={downloadDraft}
                >
                  {t("downloadIssueDraft")}
                </button>
                <p class="blocked-note">{t("issueTargetUnavailable")}</p>
              </>
            )}
          </div>
        )}
      </section>
    </section>
  );
}

import { NeoButton, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const url = str("url");
  const method = str("method", "GET");
  const secretName = str("secretName");
  const secretAsKey = str("secretAsKey");
  const bodyText = str("body");
  const statusCode = str("statusCode", t("notAvailable"));
  const responseHeaders = str("responseHeaders", "{}");
  const responseBody = str("responseBody", t("notAvailable"));
  const isRequesting = bool("isRequesting");

  const updateField = (field: string, value: string) => {
    dispatch("updateField", field, value);
  };

  return (
    <div className="http-play-area">
      {/* Result Section */}
      <div className="response-grid">
        <div><span className="label">{t("labelStatus")}</span><span className="value">{statusCode}</span></div>
        <div><span className="label">{t("labelHeaders")}</span><span className="value">{responseHeaders}</span></div>
        <div><span className="label">{t("labelBody")}</span><span className="value">{responseBody}</span></div>
      </div>

      {/* Operation Section */}
      <div className="stack">
        <NeoInput value={url} label={t("url")} placeholder={t("urlPlaceholder")} onChange={(val) => updateField("url", val)} />
        <NeoInput value={method} label={t("method")} placeholder={t("methodPlaceholder")} onChange={(val) => updateField("method", val)} />
        <NeoInput value={secretName} label={t("secretName")} placeholder={t("optional")} onChange={(val) => updateField("secretName", val)} />
        <NeoInput value={secretAsKey} label={t("secretAsKey")} placeholder={t("secretAsKeyPlaceholder")} onChange={(val) => updateField("secretAsKey", val)} />
        <NeoInput type="textarea" value={bodyText} label={t("body")} placeholder={t("bodyPlaceholder")} aria-label={t("body")} onChange={(val) => updateField("body", val)} />
        <NeoButton variant="primary" loading={isRequesting} aria-label={t("runQuery")} onClick={() => dispatch("runQuery")}>
          {t("runQuery")}
        </NeoButton>
      </div>
    </div>
  );
}

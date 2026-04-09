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

  const did = str("did");
  const format = str("format", "resolution");
  const renderedPayload = str("renderedPayload", "{}");
  const isRequesting = bool("isRequesting");

  return (
    <div className="neodid-play-area">
      {/* Result Section */}
      <pre className="json-box">{renderedPayload}</pre>

      {/* Operation Section */}
      <div className="stack">
        <NeoInput value={did} label={t("did")} placeholder={t("didPlaceholder")} onChange={(val) => dispatch("updateDid", val)} />
        <NeoInput value={format} label={t("format")} placeholder={t("formatPlaceholder")} onChange={(val) => dispatch("updateFormat", val)} />
        <div className="button-row">
          <NeoButton variant="secondary" aria-label={t("serviceDid")} onClick={() => dispatch("applyExample", "service")}>{t("serviceDid")}</NeoButton>
          <NeoButton variant="secondary" aria-label={t("vaultDid")} onClick={() => dispatch("applyExample", "vault")}>{t("vaultDid")}</NeoButton>
          <NeoButton variant="secondary" aria-label={t("aaDid")} onClick={() => dispatch("applyExample", "aa")}>{t("aaDid")}</NeoButton>
        </div>
        <NeoButton variant="primary" loading={isRequesting} aria-label={t("resolveDid")} onClick={() => dispatch("resolveDid")}>{t("resolveDid")}</NeoButton>
        <NeoButton variant="secondary" loading={isRequesting} aria-label={t("loadProviders")} onClick={() => dispatch("loadProviders")}>{t("loadProviders")}</NeoButton>
      </div>
    </div>
  );
}

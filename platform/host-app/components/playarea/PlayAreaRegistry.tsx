import {
  CustomAnchorPlayArea,
  ProfitAnchorAdminPlayArea,
  ProfitAnchorPlayArea,
  TrustAnchorAdminPlayArea,
  TrustAnchorPlayArea,
} from "./PlayAreaAnchors";
import { NeoXBridgePlayArea } from "./PlayAreaBridge";
import {
  DailyCheckinPlayArea,
  DiceGamePlayArea,
  FogPlayPlayArea,
  GasBoxPlayArea,
  GasLuckyPoolPlayArea,
  LastSurvivorPlayArea,
  RedEnvelopePlayArea,
  SelfLoanPlayArea,
} from "./PlayAreaCoreFlows";
import { ExplorerPlayArea } from "./PlayAreaExplorer";
import { GenericPlayArea, ProfiledPlayArea } from "./PlayAreaFallbacks";
import { CouncilGovernancePlayArea } from "./PlayAreaGovernance";
import {
  ForeverAlbumPlayArea,
  NeoPayPlayArea,
  TarotPlayArea,
} from "./PlayAreaMedia";
import { OracleConsolePlayArea } from "./PlayAreaOracle";
import { PrivateTransferPlayArea } from "./PlayAreaPrivateTransfer";
import { ORACLE_APP_LABELS, PROFILED_PLAYAREAS } from "./PlayAreaProfiles";
import type {
  NativePlayAreaKind,
  PlayAreaComponent,
  PlayAreaRegistryProps,
} from "./PlayAreaShared";

export { getNativePlayAreaOperationFallback } from "./PlayAreaOperationFallbacks";
export type {
  NativePlayAreaKind,
  PlayAreaRegistryProps,
} from "./PlayAreaShared";

const PLAYAREA_REGISTRY: Record<string, PlayAreaComponent> = {
  "miniapp-last-survivor": LastSurvivorPlayArea,
  "miniapp-fogplay": FogPlayPlayArea,
  "miniapp-dice-game": DiceGamePlayArea,
  "miniapp-gasbox": GasBoxPlayArea,
  "miniapp-redenvelope": RedEnvelopePlayArea,
  "miniapp-gas-lucky-pool": GasLuckyPoolPlayArea,
  "miniapp-dailycheckin": DailyCheckinPlayArea,
  "miniapp-self-loan": SelfLoanPlayArea,
  "miniapp-profitanchor": ProfitAnchorPlayArea,
  "miniapp-trustanchor": TrustAnchorPlayArea,
  "miniapp-profitanchor-admin": ProfitAnchorAdminPlayArea,
  "miniapp-trustanchor-admin": TrustAnchorAdminPlayArea,
  "miniapp-custom-anchor": CustomAnchorPlayArea,
  "miniapp-council-governance": CouncilGovernancePlayArea,
  "miniapp-forever-album": ForeverAlbumPlayArea,
  "miniapp-neo-pay": NeoPayPlayArea,
  "miniapp-onchaintarot": TarotPlayArea,
  "miniapp-on-chain-tarot": TarotPlayArea,
  "miniapp-explorer": ExplorerPlayArea,
  "miniapp-neo-x-bridge": NeoXBridgePlayArea,
  "miniapp-private-transfer": PrivateTransferPlayArea,
};

export function hasNativePlayArea(appId: string) {
  return Boolean(getNativePlayAreaKind(appId));
}

export function getNativePlayAreaKind(
  appId: string,
): NativePlayAreaKind | null {
  if (PLAYAREA_REGISTRY[appId]) return "custom";
  if (ORACLE_APP_LABELS[appId] || appId.startsWith("miniapp-oracle-")) {
    return "oracle";
  }
  if (PROFILED_PLAYAREAS[appId]) return "profiled";
  return null;
}

export function PlayAreaRegistry(props: PlayAreaRegistryProps) {
  const Component =
    PLAYAREA_REGISTRY[props.app.app_id] ||
    (props.app.app_id.startsWith("miniapp-oracle-")
      ? OracleConsolePlayArea
      : PROFILED_PLAYAREAS[props.app.app_id]
        ? ProfiledPlayArea
        : GenericPlayArea);

  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-950/5"
      data-testid={`native-playarea-${props.app.app_id}`}
    >
      <Component {...props} />
    </div>
  );
}

// Re-export everything from the decomposed sidebar module for backward compatibility.
// The actual implementation lives in ./sidebar/ sub-components.
export {
  RightSidebarPanel,
  default,
  CHAIN_MASTER_ACCOUNTS,
  CORE_CONTRACTS,
  PLATFORM_SERVICES,
  PERMISSION_TO_SERVICE,
  truncateAddress,
  scriptHashToAddressAsync,
  copyToClipboard,
  Section,
  InfoRow,
  CopyIcon,
} from "./sidebar";

export type { ServiceContract, ContractInfo, MiniAppPermissions, ThemeColors } from "./sidebar";

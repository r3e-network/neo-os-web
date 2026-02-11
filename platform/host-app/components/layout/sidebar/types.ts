import { getThemeColors } from "../../styles";

export interface ServiceContract {
  name: string;
  address: string;
  description?: string;
}

export interface ContractInfo {
  contractAddress?: string | null;
  masterKeyAddress?: string;
  gasContractAddress?: string;
  serviceContracts?: ServiceContract[];
}

// MiniApp permissions structure
export interface MiniAppPermissions {
  payments?: boolean;
  governance?: boolean;
  rng?: boolean;
  datafeed?: boolean;
  confidential?: boolean;
  automation?: boolean;
}

// Theme colors type
export type ThemeColors = ReturnType<typeof getThemeColors>;

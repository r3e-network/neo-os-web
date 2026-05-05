export interface ExplorerSearchResult {
  type: string;
  found: boolean;
  data?: ExplorerTransactionData | ExplorerBlockData | Record<string, unknown>;
  network?: "mainnet" | "testnet";
  address?: string;
  tx_count?: number;
  transactions?: ExplorerAddressTx[];
  contract_hash?: string;
  call_count?: number;
  calls?: ExplorerContractCall[];
  source?: string;
}

export interface ExplorerBlockData {
  hash: string;
  index: number;
  time?: number;
  size?: number;
  tx_count: number;
  tx?: Array<{ hash?: string }>;
}

export interface ExplorerTransactionData {
  hash: string;
  sender: string;
  vm_state: string;
  gas_consumed: string;
  block_index: number;
  block_time: string;
  opcode_traces: ExplorerOpcodeTrace[];
  contract_calls: ExplorerContractCall[];
  syscalls: ExplorerSyscall[];
}

export interface ExplorerOpcodeTrace {
  step_index: number;
  opcode: string;
  opcode_hex: string;
  gas_consumed: string;
  instruction_ptr: number;
}

export interface ExplorerContractCall {
  tx_hash: string;
  method: string;
  contract_hash: string;
  gas_consumed: string;
  success: boolean;
}

export interface ExplorerSyscall {
  syscall_name: string;
  gas_consumed: string;
  contract_hash: string;
}

export interface ExplorerAddressTx {
  tx_hash: string;
  role: string;
  block_time: string;
}

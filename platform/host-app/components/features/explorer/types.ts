// Opcode trace from indexer
export interface OpcodeTrace {
  id: number;
  tx_hash: string;
  step_index: number;
  opcode: string;
  opcode_hex: string;
  gas_consumed: string;
  stack_size: number;
  contract_hash?: string;
  instruction_ptr: number;
}

// Contract call from indexer
export interface ContractCall {
  id: number;
  tx_hash: string;
  call_index: number;
  contract_hash: string;
  method: string;
  args: unknown[];
  gas_consumed: string;
  success: boolean;
  parent_call_id?: number;
}

// API response for opcodes endpoint
export interface OpcodesResponse {
  hash: string;
  tx_type: "simple" | "complex";
  vm_state?: string;
  gas_consumed?: string;
  opcodes: OpcodeTrace[];
  contract_calls?: ContractCall[];
  total_steps?: number;
  message?: string;
}

// Opcode categories for visualization
export type OpcodeCategory = "push" | "arithmetic" | "logic" | "stack" | "control" | "syscall" | "other";

// Opcode metadata for display
export interface OpcodeMetadata {
  name: string;
  category: OpcodeCategory;
  description: string;
  gasBase?: number;
}

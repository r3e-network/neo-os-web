import type { OpcodeCategory, OpcodeMetadata } from "./types";

// Neo N3 VM opcode metadata
const OPCODE_METADATA: Record<string, OpcodeMetadata> = {
  // Push operations
  PUSHINT8: { name: "PUSHINT8", category: "push", description: "Push 1-byte integer" },
  PUSHINT16: { name: "PUSHINT16", category: "push", description: "Push 2-byte integer" },
  PUSHINT32: { name: "PUSHINT32", category: "push", description: "Push 4-byte integer" },
  PUSHINT64: { name: "PUSHINT64", category: "push", description: "Push 8-byte integer" },
  PUSHNULL: { name: "PUSHNULL", category: "push", description: "Push null value" },
  PUSHDATA1: { name: "PUSHDATA1", category: "push", description: "Push data (1-byte length)" },
  PUSHDATA2: { name: "PUSHDATA2", category: "push", description: "Push data (2-byte length)" },
  PUSHA: { name: "PUSHA", category: "push", description: "Push address" },

  // Arithmetic
  ADD: { name: "ADD", category: "arithmetic", description: "Add two integers" },
  SUB: { name: "SUB", category: "arithmetic", description: "Subtract two integers" },
  MUL: { name: "MUL", category: "arithmetic", description: "Multiply two integers" },
  DIV: { name: "DIV", category: "arithmetic", description: "Divide two integers" },
  MOD: { name: "MOD", category: "arithmetic", description: "Modulo operation" },
  INC: { name: "INC", category: "arithmetic", description: "Increment by 1" },
  DEC: { name: "DEC", category: "arithmetic", description: "Decrement by 1" },
  NEGATE: { name: "NEGATE", category: "arithmetic", description: "Negate value" },

  // Logic
  AND: { name: "AND", category: "logic", description: "Bitwise AND" },
  OR: { name: "OR", category: "logic", description: "Bitwise OR" },
  XOR: { name: "XOR", category: "logic", description: "Bitwise XOR" },
  NOT: { name: "NOT", category: "logic", description: "Logical NOT" },
  EQUAL: { name: "EQUAL", category: "logic", description: "Check equality" },
  NOTEQUAL: { name: "NOTEQUAL", category: "logic", description: "Check inequality" },

  // Stack operations
  DUP: { name: "DUP", category: "stack", description: "Duplicate top item" },
  DROP: { name: "DROP", category: "stack", description: "Remove top item" },
  SWAP: { name: "SWAP", category: "stack", description: "Swap top two items" },
  ROT: { name: "ROT", category: "stack", description: "Rotate top three items" },
  PICK: { name: "PICK", category: "stack", description: "Copy nth item to top" },
  REVERSE3: { name: "REVERSE3", category: "stack", description: "Reverse top 3 items" },

  // Control flow
  JMP: { name: "JMP", category: "control", description: "Unconditional jump" },
  JMPIF: { name: "JMPIF", category: "control", description: "Jump if true" },
  JMPIFNOT: { name: "JMPIFNOT", category: "control", description: "Jump if false" },
  CALL: { name: "CALL", category: "control", description: "Call subroutine" },
  RET: { name: "RET", category: "control", description: "Return from call" },
  NOP: { name: "NOP", category: "control", description: "No operation" },

  // Syscalls
  SYSCALL: { name: "SYSCALL", category: "syscall", description: "System call" },
};

export function getOpcodeMetadata(opcode: string): OpcodeMetadata {
  return (
    OPCODE_METADATA[opcode] || {
      name: opcode,
      category: "other" as OpcodeCategory,
      description: "Unknown opcode",
    }
  );
}

export function getCategoryColor(category: OpcodeCategory): string {
  const colors: Record<OpcodeCategory, string> = {
    push: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    arithmetic: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    logic: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    stack: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    control: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    syscall: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    other: "bg-erobo-purple/10 text-erobo-ink dark:bg-erobo-bg-dark/30 dark:text-slate-300",
  };
  return colors[category];
}

export function formatGas(gas: string): string {
  const num = parseFloat(gas);
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toFixed(4);
}

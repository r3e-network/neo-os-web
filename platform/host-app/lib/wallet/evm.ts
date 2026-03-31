/** EIP-1193 compatible provider (MetaMask, etc.) */
interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export async function invokeEvmContract(
  contractAddress: string,
  method: string,
  args: unknown[],
  fromAddress: string
): Promise<{ txid: string }> {
  const w = typeof window !== "undefined" ? (window as unknown as { ethereum?: EIP1193Provider }) : undefined;
  if (!w?.ethereum) {
    throw new Error(`invokeEvmContract: Web3 wallet not found (contract=${contractAddress}, method=${method})`);
  }

  const eth = w.ethereum;

  // Without ABI metadata we cannot safely encode arbitrary method + args.
  // Require pre-encoded calldata in `method` or as the first arg to avoid invalid calls.
  const rawHex = method.startsWith("0x")
    ? method
    : typeof args[0] === "string" && (args[0] as string).startsWith("0x")
      ? (args[0] as string)
      : null;

  if (!rawHex) {
    throw new Error(
      "EVM invoke requires encoded calldata: pass a 0x-prefixed hex string as method or first argument."
    );
  }

  if (!/^0x[0-9a-fA-F]*$/.test(rawHex)) {
    throw new Error(`invokeEvmContract: invalid EVM calldata="${rawHex}" — expected 0x-prefixed hexadecimal string`);
  }

  try {
    const txHash = await eth.request({
      method: "eth_sendTransaction",
      params: [{
        from: fromAddress,
        to: contractAddress,
        data: rawHex,
        // value: "0x..." if amount is passed
      }]
    });

    return { txid: txHash as string };
  } catch (err: unknown) {
    // Log the actual error for debugging, but don't expose internal details to users
    if (err instanceof Error) {
      console.error("[invokeEvmContract]", err.message);
    } else {
      console.error("[invokeEvmContract]", String(err));
    }
    throw new Error(`invokeEvmContract: EVM transaction failed for contract=${contractAddress}, method=${method}. Please try again.`);
  }
}

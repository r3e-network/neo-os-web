export async function invokeEvmContract(
  contractAddress: string,
  method: string,
  args: any[],
  fromAddress: string
): Promise<{ txid: string }> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("Web3 wallet not found");
  }

  const eth = (window as any).ethereum;

  // Without ABI metadata we cannot safely encode arbitrary method + args.
  // Require pre-encoded calldata in `method` or as the first arg to avoid invalid calls.
  const rawHex = method.startsWith("0x")
    ? method
    : typeof args[0] === "string" && args[0].startsWith("0x")
      ? args[0]
      : null;

  if (!rawHex) {
    throw new Error(
      "EVM invoke requires encoded calldata: pass a 0x-prefixed hex string as method or first argument."
    );
  }

  if (!/^0x[0-9a-fA-F]*$/.test(rawHex)) {
    throw new Error("Invalid EVM calldata: expected 0x-prefixed hexadecimal string.");
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

    return { txid: txHash };
  } catch (err: any) {
    throw new Error(err.message || "EVM transaction failed");
  }
}

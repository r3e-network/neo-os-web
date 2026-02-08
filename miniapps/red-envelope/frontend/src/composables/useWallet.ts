import { ref } from "vue";

const address = ref("");
const connected = ref(false);

function getDapi(): NeoDapi | null {
  return window.OneGate ?? window.neo ?? null;
}

export function useWallet() {
  const connect = async (): Promise<string> => {
    const dapi = getDapi();
    if (!dapi) throw new Error("No Neo wallet detected");

    const res = (await dapi.request({ method: "getAccount" })) as {
      address: string;
    };
    address.value = res.address;
    connected.value = true;
    return res.address;
  };

  const invoke = async (params: {
    scriptHash: string;
    operation: string;
    args?: unknown[];
    signers?: unknown[];
  }): Promise<unknown> => {
    const dapi = getDapi();
    if (!dapi) throw new Error("No Neo wallet detected");

    return dapi.request({
      method: "invoke",
      params: {
        scriptHash: params.scriptHash,
        operation: params.operation,
        args: params.args ?? [],
        signers: params.signers ?? [{ account: address.value, scopes: "CalledByEntry" }],
      },
    });
  };

  const invokeRead = async (params: { scriptHash: string; operation: string; args?: unknown[] }): Promise<unknown> => {
    const dapi = getDapi();
    if (!dapi) throw new Error("No Neo wallet detected");

    return dapi.request({
      method: "invokeRead",
      params: {
        scriptHash: params.scriptHash,
        operation: params.operation,
        args: params.args ?? [],
        signers: [],
      },
    });
  };

  const getBalance = async (asset: string): Promise<string> => {
    const dapi = getDapi();
    if (!dapi) return "0";

    const res = (await dapi.request({
      method: "getBalance",
      params: { address: address.value, contracts: [asset] },
    })) as { balance: string }[];

    return res?.[0]?.balance ?? "0";
  };

  /** Auto-connect if a dapi provider is already injected */
  const autoConnect = async (): Promise<void> => {
    if (connected.value) return;
    if (!getDapi()) return;
    try {
      await connect();
    } catch {
      // silent — user can connect manually
    }
  };

  return { address, connected, connect, autoConnect, invoke, invokeRead, getBalance };
}

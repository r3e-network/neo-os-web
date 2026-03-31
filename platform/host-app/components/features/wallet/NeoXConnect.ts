export const NEO_X_MAINNET = {
  chainId: '0xba93', // 47763
  chainName: 'Neo X MainNet',
  nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 },
  rpcUrls: ['https://mainnet-1.rpc.banelabs.org'],
  blockExplorerUrls: ['https://xexplorer.neo.org']
};

export const NEO_X_TESTNET = {
  chainId: '0xba9304', // 12227332
  chainName: 'Neo X TestNet',
  nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 },
  rpcUrls: ['https://neoxt4seed1.ngd.network'],
  blockExplorerUrls: ['https://xt4scan.ngd.network']
};

/** EIP-1193 compatible provider (MetaMask, etc.) */
interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export async function connectNeoX(isTestnet = false) {
  const w = typeof window !== 'undefined' ? (window as unknown as { ethereum?: EIP1193Provider }) : undefined;
  if (!w?.ethereum) {
    throw new Error('MetaMask or compatible Web3 wallet is not installed.');
  }

  const eth = w.ethereum;
  const network = isTestnet ? NEO_X_TESTNET : NEO_X_MAINNET;

  try {
    await eth.request({ method: 'eth_requestAccounts' });
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: network.chainId }],
      });
    } catch (switchError: unknown) {
      if (typeof switchError === "object" && switchError !== null && (switchError as { code?: number }).code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [network],
        });
      } else {
        throw switchError;
      }
    }
    const accounts = await eth.request({ method: 'eth_accounts' }) as string[];
    return accounts[0];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to connect to Neo X.";
    throw new Error(message);
  }
}

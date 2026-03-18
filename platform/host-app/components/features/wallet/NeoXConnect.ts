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

export async function connectNeoX(isTestnet = false) {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('MetaMask or compatible Web3 wallet is not installed.');
  }

  const eth = (window as any).ethereum;
  const network = isTestnet ? NEO_X_TESTNET : NEO_X_MAINNET;

  try {
    await eth.request({ method: 'eth_requestAccounts' });
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: network.chainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [network],
        });
      } else {
        throw switchError;
      }
    }
    const accounts = await eth.request({ method: 'eth_accounts' });
    return accounts[0];
  } catch (error: any) {
    throw new Error(error.message || 'Failed to connect to Neo X.');
  }
}

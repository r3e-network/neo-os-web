export const NEO_X_MAINNET = {
  chainId: '0x12d3f', // 77119
  chainName: 'Neo X Mainnet',
  nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 },
  rpcUrls: ['https://mainnet-1.rpc.banelabs.org'],
  blockExplorerUrls: ['https://explorer.neo-x.network']
};

export const NEO_X_TESTNET = {
  chainId: '0x122a', // 4650
  chainName: 'Neo X Testnet',
  nativeCurrency: { name: 'GAS', symbol: 'GAS', decimals: 18 },
  rpcUrls: ['https://testnet.rpc.banelabs.org'],
  blockExplorerUrls: ['https://explorer.neo-x.testnet.network']
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
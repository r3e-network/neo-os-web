import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK, IProvider } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { WalletAdapter, WalletAccount, WalletBalance, SignedMessage, InvokeParams, TransactionResult, WalletConnectionError } from "./base";
import { ethers } from "ethers";

export class Web3AuthAdapter implements WalletAdapter {
  readonly name = "Web3Auth";
  readonly icon = "https://web3auth.io/images/w3a-L-Favicon-1.svg";
  readonly downloadUrl = "https://web3auth.io/";

  private web3auth: Web3Auth | null = null;
  private provider: IProvider | null = null;
  
  // Neo X Mainnet Configuration
  private chainConfig = {
    chainNamespace: CHAIN_NAMESPACES.EIP155,
    chainId: "0x12038", // 74808 in hex
    rpcTarget: "https://mainnet-1.rpc.banelabs.org",
    displayName: "Neo X Mainnet",
    blockExplorerUrl: "https://xexplorer.neo.org",
    ticker: "GAS",
    tickerName: "GAS",
  };

  isInstalled(): boolean {
    return true; // Web3Auth doesn't require an extension
  }

  async init(): Promise<void> {
    if (this.web3auth) return;

    try {
      const clientId = process.env.VITE_WEB3AUTH_CLIENT_ID || process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "";
      if (!clientId) {
        throw new Error("Web3Auth Client ID is not configured");
      }

      const networkString = process.env.VITE_WEB3AUTH_NETWORK || process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK || "sapphire_mainnet";

      const privateKeyProvider = new EthereumPrivateKeyProvider({ config: { chainConfig: this.chainConfig } });

      this.web3auth = new Web3Auth({
        clientId,
        web3AuthNetwork: networkString as any,
        privateKeyProvider,
      });

      await this.web3auth.initModal();
    } catch (error) {
      console.error("Failed to initialize Web3Auth:", error);
      throw new WalletConnectionError(`Failed to initialize Web3Auth: ${error}`);
    }
  }

  async connect(): Promise<WalletAccount> {
    try {
      await this.init();
      if (!this.web3auth) throw new Error("Web3Auth not initialized");

      this.provider = await this.web3auth.connect();
      if (!this.provider) throw new Error("Failed to get provider from Web3Auth");

      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      
      // Fallback for Neo X (since Neo N3 adapters expect Neo formats)
      // Web3Auth primarily gives an EVM address. We'll use the EVM address 
      // as both the address and public key for compatibility with the generic interface.
      return {
        address,
        publicKey: address, // In EVM, we often don't have raw pubkey without a signature
        label: "Web3Auth Account",
      };
    } catch (error) {
      console.error("Web3Auth connection error:", error);
      throw new WalletConnectionError(`Failed to connect to Web3Auth: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.web3auth) {
      await this.web3auth.logout();
      this.provider = null;
    }
  }

  async getBalance(address: string): Promise<WalletBalance> {
    if (!this.provider) return { neo: "0", gas: "0" };

    try {
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const balance = await ethersProvider.getBalance(address);
      const formattedBalance = ethers.formatEther(balance);
      
      // Map native token (GAS on Neo X) to gas field
      return {
        neo: "0",
        gas: formattedBalance,
      };
    } catch (error) {
      console.error("Failed to get Web3Auth balance:", error);
      return { neo: "0", gas: "0" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    if (!this.provider) throw new WalletConnectionError("Not connected to Web3Auth");

    try {
      const ethersProvider = new ethers.BrowserProvider(this.provider);
      const signer = await ethersProvider.getSigner();
      const signature = await signer.signMessage(message);
      const address = await signer.getAddress();

      return {
        publicKey: address,
        data: signature,
        salt: "",
        message,
      };
    } catch (error) {
      throw new WalletConnectionError(`Failed to sign message with Web3Auth: ${error}`);
    }
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (!this.provider) throw new WalletConnectionError("Not connected to Web3Auth");

    try {
      throw new Error("Generic smart contract invocation via Web3Auth/NeoX requires EVM ABI definitions which are not provided in this payload.");
    } catch (error) {
      throw new WalletConnectionError(`Web3Auth invocation failed: ${error}`);
    }
  }
}

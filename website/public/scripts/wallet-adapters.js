// Neo N3 Wallet Adapters
// This script provides compatibility and consistent interfaces for different Neo N3 wallets

// NeoLine adapter for Neo N3
class NeoLineAdapter {
  constructor() {
    this.initialized = false;
    this.instance = null;
    this.name = 'NeoLine';
    this.initRetries = 0;
    this.maxRetries = 5;
  }

  async init() {
    if (this.initialized) return true;
    
    try {
      if (window.NEOLineN3) {
        this.instance = new window.NEOLineN3.Init();
        this.initialized = true;
        console.log('NeoLine initialized successfully');
        return true;
      } else {
        // If NEOLineN3 is not available yet, try again with a delay
        if (this.initRetries < this.maxRetries) {
          console.log(`NeoLine not available yet, retrying... (${this.initRetries + 1}/${this.maxRetries})`);
          return await this.tryInit();
        } else {
          console.error('Failed to initialize NeoLine: NEOLineN3 not found after maximum retries');
        }
      }
    } catch (error) {
      console.error('Failed to initialize NeoLine:', error);
    }
    
    return this.initialized;
  }

  async tryInit() {
    this.initRetries++;
    
    return new Promise(resolve => {
      setTimeout(async () => {
        if (window.NEOLineN3) {
          try {
            this.instance = new window.NEOLineN3.Init();
            this.initialized = true;
            console.log('NeoLine initialized successfully after retry');
            resolve(true);
          } catch (error) {
            console.error('Failed to initialize NeoLine during retry:', error);
            resolve(await this.init()); // Try again if we still have retries left
          }
        } else {
          resolve(await this.init()); // Try again if we still have retries left
        }
      }, 1000); // 1 second delay between retries
    });
  }

  isInstalled() {
    return typeof window !== 'undefined' && window.NEOLineN3 !== undefined;
  }

  async getAccount() {
    if (!this.initialized) await this.init();
    return this.instance.getAccount();
  }

  async getBalance(params) {
    if (!this.initialized) await this.init();
    return this.instance.getBalance(params);
  }

  async getNetworks() {
    if (!this.initialized) await this.init();
    return this.instance.getNetworks();
  }

  async signMessage(params) {
    if (!this.initialized) await this.init();
    return this.instance.signMessage(params);
  }

  async invoke(params) {
    if (!this.initialized) await this.init();
    return this.instance.invoke(params);
  }
}

// O3 adapter for Neo N3
class O3Adapter {
  constructor() {
    this.initialized = false;
    this.instance = null;
    this.name = 'O3';
    this.initRetries = 0;
    this.maxRetries = 5;
  }

  async init() {
    if (this.initialized) return true;
    
    try {
      if (window.NEO && window.NEO.O3) {
        this.instance = window.NEO.O3;
        this.initialized = true;
        console.log('O3 wallet initialized successfully');
        return true;
      } else {
        // If NEO.O3 is not available yet, try again with a delay
        if (this.initRetries < this.maxRetries) {
          console.log(`O3 not available yet, retrying... (${this.initRetries + 1}/${this.maxRetries})`);
          return await this.tryInit();
        } else {
          console.error('Failed to initialize O3: NEO.O3 not found after maximum retries');
        }
      }
    } catch (error) {
      console.error('Failed to initialize O3:', error);
    }
    
    return this.initialized;
  }

  async tryInit() {
    this.initRetries++;
    
    return new Promise(resolve => {
      setTimeout(async () => {
        if (window.NEO && window.NEO.O3) {
          try {
            this.instance = window.NEO.O3;
            this.initialized = true;
            console.log('O3 initialized successfully after retry');
            resolve(true);
          } catch (error) {
            console.error('Failed to initialize O3 during retry:', error);
            resolve(await this.init()); // Try again if we still have retries left
          }
        } else {
          resolve(await this.init()); // Try again if we still have retries left
        }
      }, 1000); // 1 second delay between retries
    });
  }

  isInstalled() {
    return typeof window !== 'undefined' && 
      window.NEO && window.NEO.O3 !== undefined;
  }

  async getAccount() {
    if (!this.initialized) await this.init();
    return this.instance.request(this.instance.REQUEST_METHOD.GET_ACCOUNT);
  }

  async getBalance(params) {
    if (!this.initialized) await this.init();
    return this.instance.request(this.instance.REQUEST_METHOD.GET_BALANCE, params);
  }

  async getNetworks() {
    if (!this.initialized) await this.init();
    return this.instance.request(this.instance.REQUEST_METHOD.NETWORK);
  }

  async signMessage(params) {
    if (!this.initialized) await this.init();
    return this.instance.request(this.instance.REQUEST_METHOD.SIGN_MESSAGE, params);
  }

  async invoke(params) {
    if (!this.initialized) await this.init();
    return this.instance.request(this.instance.REQUEST_METHOD.INVOKE, params);
  }
}

// Neon adapter
class NeonAdapter {
  constructor() {
    this.initialized = false;
    this.instance = null;
    this.name = 'Neon';
  }

  async init() {
    if (this.initialized) return;
    
    try {
      if (window.neon) {
        this.instance = window.neon;
        this.initialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize Neon:', error);
    }
    
    return this.initialized;
  }

  isInstalled() {
    return typeof window !== 'undefined' && window.neon !== undefined;
  }

  async getAccount() {
    if (!this.initialized) await this.init();
    return this.instance.getAccount();
  }

  async getBalance(params) {
    if (!this.initialized) await this.init();
    return this.instance.getBalance(params);
  }

  async getNetworks() {
    if (!this.initialized) await this.init();
    return this.instance.getNetworks();
  }

  async signMessage(params) {
    if (!this.initialized) await this.init();
    return this.instance.signMessage(params);
  }

  async invoke(params) {
    if (!this.initialized) await this.init();
    return this.instance.invoke(params);
  }
}

// OneGate adapter
class OneGateAdapter {
  constructor() {
    this.initialized = false;
    this.instance = null;
    this.name = 'OneGate';
  }

  async init() {
    if (this.initialized) return;
    
    try {
      if (window.OneGate) {
        this.instance = window.OneGate;
        this.initialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize OneGate:', error);
    }
    
    return this.initialized;
  }

  isInstalled() {
    return typeof window !== 'undefined' && window.OneGate !== undefined;
  }

  async getAccount() {
    if (!this.initialized) await this.init();
    return this.instance.getAccount();
  }

  async getBalance(params) {
    if (!this.initialized) await this.init();
    return this.instance.getBalance(params);
  }

  async getNetworks() {
    if (!this.initialized) await this.init();
    return this.instance.getNetwork();
  }

  async signMessage(params) {
    if (!this.initialized) await this.init();
    return this.instance.signMessage(params);
  }

  async invoke(params) {
    if (!this.initialized) await this.init();
    return this.instance.invoke(params);
  }
}

// Export wallet adapters to global scope
window.neoWalletAdapters = {
  NeoLine: new NeoLineAdapter(),
  O3: new O3Adapter(),
  Neon: new NeonAdapter(),
  OneGate: new OneGateAdapter(),
  
  getInstalledWallets() {
    const installedWallets = [];
    
    if (this.NeoLine.isInstalled()) {
      installedWallets.push(this.NeoLine);
    }
    
    if (this.O3.isInstalled()) {
      installedWallets.push(this.O3);
    }
    
    if (this.Neon.isInstalled()) {
      installedWallets.push(this.Neon);
    }
    
    if (this.OneGate.isInstalled()) {
      installedWallets.push(this.OneGate);
    }
    
    return installedWallets;
  }
}; 

// Initialize wallet adapters and log their status when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Neo N3 wallet adapters...');
  
  // Check if the global object is defined
  if (!window.neoWalletAdapters) {
    console.error('ERROR: neoWalletAdapters global object is not defined!');
    return;
  }
  
  // Check for wallet availability and log status
  setTimeout(() => {
    const neoline = window.neoWalletAdapters.NeoLine.isInstalled();
    const o3 = window.neoWalletAdapters.O3.isInstalled();
    const neon = window.neoWalletAdapters.Neon.isInstalled();
    const onegate = window.neoWalletAdapters.OneGate.isInstalled();
    
    console.log('Wallet availability status:');
    console.log('- NeoLine:', neoline ? 'Available' : 'Not available');
    console.log('- O3:', o3 ? 'Available' : 'Not available');
    console.log('- Neon:', neon ? 'Available' : 'Not available');
    console.log('- OneGate:', onegate ? 'Available' : 'Not available');
    
    // Log window objects for debugging
    console.log('Window wallet objects:');
    console.log('- window.NEOLineN3:', window.NEOLineN3 ? 'Exists' : 'Missing');
    console.log('- window.NEO:', window.NEO ? 'Exists' : 'Missing');
    console.log('- window.neon:', window.neon ? 'Exists' : 'Missing');
    console.log('- window.OneGate:', window.OneGate ? 'Exists' : 'Missing');
  }, 1000); // Delay to ensure wallets have had time to initialize
}); 
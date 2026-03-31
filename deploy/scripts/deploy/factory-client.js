/**
 * MiniAppFactoryV2 Client Library (JavaScript)
 * For frontend integration and runtime interactions
 * 
 * Usage:
 *   const factory = require('./factory-client.js');
 *   const client = factory.createClient({ rpc: 'https://testnet1.neo.coz.io:443' });
 * 
 *   // Get template info
 *   const template = await client.getTemplate('lottery-v1');
 * 
 *   // Deploy from template
 *   const appHash = await client.deployFromTemplate('lottery-v1', { ...config });
 */

const http = require('http');
const https = require('https');

class FactoryClient {
  constructor(options = {}) {
    this.rpc = options.rpc || 'https://testnet1.neo.coz.io:443';
    this.factoryHash = options.factoryHash || null;
    // Neo N3 TestNet T5 network magic
    this.networkMagic = options.networkMagic || 894710606;
    this.timeout = options.timeout || 30000;
  }

  /**
   * Make RPC request to Neo node
   */
  async rpcCall(method, params = []) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.rpc);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const postData = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname || '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.timeout
      };

      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message));
            } else {
              resolve(json.result);
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Parse script hash from hex or base64
   */
  parseHash(hash) {
    if (typeof hash === 'string') {
      if (hash.startsWith('0x')) {
        return Buffer.from(hash.slice(2), 'hex').reverse();
      }
      return Buffer.from(hash, 'hex').reverse();
    }
    return hash;
  }

  /**
   * Convert address to script hash
   */
  addressToHash(address) {
    // Neo N3 address to script hash conversion
    const { base58 } = require('./vendor/base58');
    const decoded = base58.decode(address);
    return decoded.slice(1, -4);
  }

  /**
   * Invoke contract read method
   */
  async invokeRead(contractHash, method, params = []) {
    const scriptHash = typeof contractHash === 'string' 
      ? this.addressToHash(contractHash) 
      : contractHash;

    return this.rpcCall('invokefunction', [
      scriptHash.toString('hex'),
      method,
      params.map(p => this.serializeParam(p))
    ]);
  }

  /**
   * Serialize parameter for Neo VM
   */
  serializeParam(param) {
    if (typeof param === 'string') {
      if (param.startsWith('0x')) {
        return { type: 'Hash160', value: param.slice(2) };
      }
      return { type: 'String', value: param };
    }
    if (typeof param === 'number' || typeof param === 'bigint') {
      return { type: 'Integer', value: param.toString() };
    }
    if (Buffer.isBuffer(param)) {
      return { type: 'ByteArray', value: param.toString('hex') };
    }
    if (Array.isArray(param)) {
      return { type: 'Array', value: param.map(p => this.serializeParam(p)) };
    }
    return { type: 'Any', value: param };
  }

  /**
   * Get template information
   */
  async getTemplate(templateId) {
    if (!this.factoryHash) {
      throw new Error('Factory hash not set');
    }

    const result = await this.invokeRead(this.factoryHash, 'getTemplate', [templateId]);
    
    if (!result.stack || result.stack.length === 0) {
      return null;
    }

    return this.parseTemplateInfo(result.stack[0]);
  }

  /**
   * Parse template info from VM stack
   */
  parseTemplateInfo(stackItem) {
    if (!stackItem || !stackItem.value) return null;
    
    const values = Array.isArray(stackItem.value) ? stackItem.value : [];
    
    return {
      templateId: this.extractString(values[0]),
      templateType: this.extractString(values[1]),
      category: this.extractString(values[2]),
      nefHash: this.extractBytes(values[3]),
      manifestHash: this.extractBytes(values[4]),
      description: this.extractString(values[5]),
      version: this.extractString(values[6]),
      configSchema: this.extractString(values[7]),
      uiSchema: this.extractString(values[8]),
      active: this.extractBool(values[9]),
      deployCount: this.extractInt(values[10])
    };
  }

  extractString(item) {
    if (!item || !item.value) return '';
    return item.type === 'String' ? item.value : 
           item.type === 'ByteArray' ? Buffer.from(item.value, 'hex').toString('utf8') : '';
  }

  extractBytes(item) {
    if (!item || !item.value) return '';
    return item.type === 'ByteArray' ? '0x' + item.value : '';
  }

  extractInt(item) {
    if (!item || !item.value) return 0;
    return typeof item.value === 'string' ? parseInt(item.value, 10) : 0;
  }

  extractBool(item) {
    if (!item || !item.value) return false;
    return item.value === true || item.value === 1 || item.value === '1';
  }

  /**
   * Get all templates by category
   */
  async getTemplatesByCategory(category) {
    const result = await this.invokeRead(this.factoryHash, 'getTemplatesByCategory', [category]);
    return this.extractArray(result.stack?.[0]);
  }

  /**
   * Get all available categories
   */
  async getCategories() {
    const result = await this.invokeRead(this.factoryHash, 'getAllCategories');
    return this.extractArray(result.stack?.[0]);
  }

  /**
   * Deploy MiniApp from template
   * Note: This requires a wallet signature
   */
  async deployFromTemplate(templateId, initParams = {}) {
    if (!this.factoryHash) {
      throw new Error('Factory hash not set');
    }

    // Serialize init params
    const serializedParams = Buffer.from(JSON.stringify(initParams)).toString('hex');
    
    return {
      // Return transaction data for signing
      templateId,
      factoryHash: this.factoryHash,
      method: 'deployFromTemplate',
      params: [templateId, serializedParams],
      serialize: () => this.buildDeployScript(templateId, serializedParams)
    };
  }

  /**
   * Deploy and register in one transaction
   */
  async deployAndRegister(templateId, appId, name, description, initParams = {}) {
    const serializedParams = Buffer.from(JSON.stringify(initParams)).toString('hex');
    
    return {
      templateId,
      appId,
      factoryHash: this.factoryHash,
      method: 'deployAndRegister',
      params: [templateId, serializedParams, appId, name, description]
    };
  }

  /**
   * Get deployment count for a template
   */
  async getDeploymentCount(templateId) {
    const result = await this.invokeRead(this.factoryHash, 'getDeploymentCount', [templateId]);
    return this.extractInt(result.stack?.[0]);
  }

  /**
   * Validate configuration against schema
   */
  async validateConfig(templateId, config) {
    const serializedConfig = Buffer.from(JSON.stringify(config)).toString('hex');
    const result = await this.invokeRead(
      this.factoryHash, 
      'validateConfig', 
      [templateId, serializedConfig]
    );
    return this.extractBool(result.stack?.[0]);
  }

  /**
   * Get factory admin
   */
  async getAdmin() {
    const result = await this.invokeRead(this.factoryHash, 'admin');
    return this.extractBytes(result.stack?.[0]);
  }

  /**
   * Get AppRegistry address
   */
  async getAppRegistry() {
    const result = await this.invokeRead(this.factoryHash, 'appRegistry');
    return this.extractBytes(result.stack?.[0]);
  }

  extractArray(stackItem) {
    if (!stackItem || !stackItem.value || !Array.isArray(stackItem.value)) {
      return [];
    }
    return stackItem.value.map(item => {
      if (item.type === 'String') return item.value;
      if (item.type === 'ByteArray') return Buffer.from(item.value, 'hex').toString('utf8');
      return item.value?.toString() || '';
    });
  }

  /**
   * Build deploy script for signing
   */
  buildDeployScript(templateId, initParams) {
    // Build Neo VM script for deployFromTemplate
    const script = [];
    
    // Push templateId
    script.push(...this.pushString(templateId));
    // Push initParams
    script.push(...this.pushBytes(initParams));
    
    // Call contract method
    script.push(0x10); // PUSH2
    script.push(0x00); // SysCall Contract.Call
    
    return Buffer.from(script).toString('hex');
  }

  pushString(str) {
    const bytes = Buffer.from(str, 'utf8');
    const result = [...bytes];
    result.unshift(bytes.length);
    return result;
  }

  pushBytes(hex) {
    const bytes = Buffer.from(hex, 'hex');
    const result = [...bytes];
    result.unshift(bytes.length);
    return result;
  }
}

/**
 * Factory Client for frontend integration
 */
function createClient(options = {}) {
  return new FactoryClient(options);
}

/**
 * Template definitions for common MiniApps
 */
const TEMPLATES = {
  lottery: {
    id: 'lottery-v1',
    name: 'Lottery Game',
    type: 'lottery',
    category: 'gaming',
    configSchema: {
      ticketPrice: { type: 'integer', min: 10000000 },
      maxPlayers: { type: 'integer', default: 100 },
      drawInterval: { type: 'integer', default: 86400 }
    },
    uiSchema: {
      primaryColor: '#6366f1',
      icon: '🎰',
      theme: 'dark'
    }
  },
  coinflip: {
    id: 'coinflip-v1',
    name: 'Coin Flip',
    type: 'coinflip',
    category: 'gaming',
    configSchema: {
      minBet: { type: 'integer', min: 1000000 },
      maxBet: { type: 'integer', max: 100000000 }
    }
  },
  prediction: {
    id: 'prediction-v1',
    name: 'Prediction Market',
    type: 'prediction',
    category: 'defi',
    configSchema: {
      minStake: { type: 'integer', min: 10000000 },
      eventDuration: { type: 'integer', default: 3600 }
    }
  },
  priceTicker: {
    id: 'priceticker-v1',
    name: 'Price Ticker',
    type: 'priceticker',
    category: 'defi',
    configSchema: {
      assets: { type: 'array', default: ['NEO', 'GAS', 'FLM'] },
      updateInterval: { type: 'integer', default: 300 }
    }
  }
};

/**
 * Deploy transaction builder
 */
class DeployTransactionBuilder {
  constructor(factoryHash, templateId, options = {}) {
    this.factoryHash = factoryHash;
    this.templateId = templateId;
    this.options = options;
  }

  /**
   * Build invocation script
   */
  buildScript() {
    const params = this.serializeParams();
    
    // Simple script builder for deployFromTemplate
    // In production, use @neo-one/client or neo-ts-compiler
    return {
      scriptHash: this.factoryHash,
      operation: 'deployFromTemplate',
      args: [this.templateId, params]
    };
  }

  serializeParams() {
    return Buffer.from(JSON.stringify(this.options.initParams || {})).toString('hex');
  }

  toJSON() {
    return {
      templateId: this.templateId,
      factoryHash: this.factoryHash,
      initParams: this.options.initParams,
      appId: this.options.appId,
      name: this.options.name,
      description: this.options.description
    };
  }
}

module.exports = {
  FactoryClient,
  createClient,
  TEMPLATES,
  DeployTransactionBuilder
};

// CommonJS compatibility
if (typeof window !== 'undefined') {
  window.MiniAppFactory = {
    createClient,
    TEMPLATES,
    DeployTransactionBuilder
  };
}

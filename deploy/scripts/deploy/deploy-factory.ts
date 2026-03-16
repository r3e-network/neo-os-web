#!/usr/bin/env npx ts-node
/**
 * MiniAppFactoryV2 Deployment Script (TypeScript)
 * For frontend integration and automated deployments
 * 
 * Usage:
 *   npx ts-node deploy-factory.ts [options]
 * 
 * Options:
 *   --network <network>   Network: neoexpress, testnet, mainnet
 *   --rpc <url>          RPC endpoint URL
 *   --wallet <path>      Wallet file path
 *   --account <name>     Account name in wallet
 *   --factory <hash>     Existing factory contract hash (for updates)
 */

import { 
  rpc, 
  wallet, 
  sc,
  constants,
  u,
  contract
} from '@neo-one/client';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';

interface DeployOptions {
  network: string;
  rpc: string;
  wallet: string;
  account: string;
  factory?: string;
}

interface DeployedContract {
  name: string;
  hash: string;
  nef: string;
  manifest: string;
}

interface TemplateDefinition {
  id: string;
  name: string;
  type: string;
  category: string;
  nefPath: string;
  manifestPath: string;
  description: string;
  version: string;
  configSchema?: string;
  uiSchema?: string;
}

const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'lottery-v1',
    name: 'MiniAppLottery',
    type: 'lottery',
    category: 'gaming',
    nefPath: 'contracts/build/MiniAppLottery.nef',
    manifestPath: 'contracts/build/MiniAppLottery.manifest.json',
    description: 'Classic lottery game template',
    version: '1.0.0',
    configSchema: JSON.stringify({
      ticketPrice: { type: 'integer', min: 10000000 },
      maxPlayers: { type: 'integer', default: 100 },
      drawInterval: { type: 'integer', default: 86400 }
    }),
    uiSchema: JSON.stringify({
      primaryColor: '#6366f1',
      icon: '🎰'
    })
  },
  {
    id: 'coinflip-v1',
    name: 'MiniAppFogPlay',
    type: 'coinflip',
    category: 'gaming',
    nefPath: 'contracts/build/MiniAppFogPlay.nef',
    manifestPath: 'contracts/build/MiniAppFogPlay.manifest.json',
    description: 'Simple coin flip betting game',
    version: '1.0.0',
    configSchema: JSON.stringify({
      minBet: { type: 'integer', min: 1000000 },
      maxBet: { type: 'integer', max: 100000000 }
    })
  },
  {
    id: 'prediction-v1',
    name: 'MiniAppPredictionMarket',
    type: 'prediction',
    category: 'defi',
    nefPath: 'contracts/build/MiniAppPredictionMarket.nef',
    manifestPath: 'contracts/build/MiniAppPredictionMarket.manifest.json',
    description: 'Prediction market template',
    version: '1.0.0'
  }
];

class FactoryDeployer {
  private options: DeployOptions;
  private client: rpc.RPCClient;
  private walletAccount: wallet.Account;

  constructor(options: DeployOptions) {
    this.options = options;
    this.client = new rpc.RPCClient(options.rpc);
    
    // Load wallet
    const walletData = JSON.parse(fs.readFileSync(options.wallet, 'utf-8'));
    this.walletAccount = walletData.accounts.find(
      (acc: any) => acc.name === options.account || acc.label === options.account
    );
    
    if (!this.walletAccount) {
      throw new Error(`Account ${options.account} not found in wallet`);
    }
  }

  async buildContract(contractPath: string): Promise<{ nef: Buffer; manifest: any }> {
    console.log(`  Building ${contractPath}...`);
    
    // Check if compiled
    const nefPath = contractPath.replace('.cs', '.nef');
    if (!fs.existsSync(nefPath)) {
      throw new Error(`Contract not compiled: ${nefPath}`);
    }

    const nef = fs.readFileSync(nefPath);
    const manifest = JSON.parse(fs.readFileSync(
      contractPath.replace('.cs', '.manifest.json')
    ).toString());

    return { nef, manifest };
  }

  async deployFactory(): Promise<string> {
    console.log('\n=== Deploying MiniAppFactoryV2 ===');
    
    const factoryPath = 'contracts/MiniAppFactoryV2/MiniAppFactoryV2.cs';
    const { nef, manifest } = await this.buildContract(factoryPath);

    // Check if already deployed
    if (this.options.factory) {
      console.log(`  Updating existing factory at ${this.options.factory}`);
      // Update contract logic here
      return this.options.factory;
    }

    // Deploy new
    const deployParams = {
      nef: u.Buffer.from(nef).toString('hex'),
      manifest: JSON.stringify(manifest),
      data: Buffer.alloc(0)
    };

    try {
      const result = await this.client.invoke({
        script: contract.createDeploy(
          deployParams.nef,
          deployParams.manifest,
          deployParams.data
        ),
        account: this.walletAccount.address
      });

      const contractHash = result.stack?.[0]?.value as string;
      console.log(`  Deployed: ${contractHash}`);
      
      return contractHash;
    } catch (error) {
      console.error('  Deployment failed:', error);
      throw error;
    }
  }

  async registerTemplate(template: TemplateDefinition, factoryHash: string): Promise<void> {
    console.log(`\nRegistering template: ${template.id}`);

    const { nef, manifest } = await this.buildContract(template.nefPath);

    const script = sc.createScript([
      // Call upsertTemplate method
      sc.callMethod(
        'upsertTemplate',
        [
          template.id,
          template.type,
          template.category,
          u.Buffer.from(nef).toString('hex'),
          JSON.stringify(manifest),
          template.description,
          template.version,
          template.configSchema || '{}',
          template.uiSchema || '{}',
          true
        ]
      )
    ]);

    await this.client.invoke({
      script: script.build(),
      account: this.walletAccount.address
    });

    console.log(`  ✓ ${template.id} registered`);
  }

  async initializeFactory(factoryHash: string, appRegistryHash: string): Promise<void> {
    console.log('\n=== Initializing Factory ===');
    
    // Set AppRegistry
    const script = sc.createScript([
      sc.callMethod('setAppRegistry', [appRegistryHash])
    ]);

    await this.client.invoke({
      script: script.build(),
      account: this.walletAccount.address
    });

    console.log('  ✓ AppRegistry set');
  }

  async deploy(): Promise<void> {
    try {
      // Deploy factory
      const factoryHash = await this.deployFactory();

      // Register templates
      console.log('\n=== Registering Templates ===');
      for (const template of DEFAULT_TEMPLATES) {
        await this.registerTemplate(template, factoryHash);
      }

      // Save deployment info
      this.saveDeploymentInfo(factoryHash);
      
      console.log('\n=== Deployment Complete ===');
      console.log(`Factory: ${factoryHash}`);
      console.log(`Templates: ${DEFAULT_TEMPLATES.length}`);
    } catch (error) {
      console.error('Deployment failed:', error);
      process.exit(1);
    }
  }

  private saveDeploymentInfo(factoryHash: string): void {
    const configDir = 'deploy/config';
    const deployedFile = `${configDir}/factory_deployed.json`;
    
    const data = {
      MiniAppFactoryV2: factoryHash,
      network: this.options.network,
      rpc: this.options.rpc,
      deployedAt: new Date().toISOString(),
      templates: DEFAULT_TEMPLATES.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        category: t.category
      }))
    };

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(deployedFile, JSON.stringify(data, null, 2));
    console.log(`\nDeployment info saved to: ${deployedFile}`);
  }
}

// CLI
const argv = yargs
  .option('network', {
    alias: 'n',
    description: 'Network to deploy to',
    choices: ['neoexpress', 'testnet', 'mainnet'],
    default: 'testnet'
  })
  .option('rpc', {
    alias: 'r',
    description: 'RPC endpoint URL',
    default: 'https://testnet1.neo.coz.io:443'
  })
  .option('wallet', {
    alias: 'w',
    description: 'Path to wallet file',
    demandOption: true
  })
  .option('account', {
    alias: 'a',
    description: 'Account name in wallet',
    default: 'owner'
  })
  .option('factory', {
    alias: 'f',
    description: 'Existing factory hash (for updates)'
  })
  .help()
  .argv as any;

const deployer = new FactoryDeployer({
  network: argv.network,
  rpc: argv.rpc,
  wallet: argv.wallet,
  account: argv.account,
  factory: argv.factory
});

deployer.deploy();

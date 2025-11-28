import 'dotenv/config';
import { rpc, sc, tx, u, wallet } from '@cityofzion/neon-js';

const cfg = {
  api: process.env.SERVICE_LAYER_API || 'http://localhost:8080',
  token: process.env.SERVICE_LAYER_TOKEN || '',
  tenant: process.env.SERVICE_LAYER_TENANT || '',
  account: process.env.ACCOUNT_ID || '',
  priceFeed: process.env.PRICE_FEED_ID || '',
  rpcURL: process.env.RPC_URL || 'http://localhost:20332',
  wif: process.env.WIF || '',
  contractHash: process.env.CONTRACT_HASH || '',
  contractMethod: process.env.CONTRACT_METHOD || 'updatePrice',
  networkFee: parseFloat(process.env.NETWORK_FEE || '0.001'),
};

function requireValue(name, value) {
  if (!value || value.includes('<')) {
    throw new Error(`Missing ${name}; set it in .env`);
  }
}

requireValue('ACCOUNT_ID', cfg.account);
requireValue('PRICE_FEED_ID', cfg.priceFeed);
requireValue('WIF', cfg.wif);
requireValue('CONTRACT_HASH', cfg.contractHash);

const headers = {
  'Content-Type': 'application/json',
  ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
  ...(cfg.tenant ? { 'X-Tenant-ID': cfg.tenant } : {}),
};

async function fetchLatestPrice() {
  const url = `${cfg.api}/accounts/${cfg.account}/pricefeeds/${cfg.priceFeed}/snapshots`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Price feed request failed (${res.status}): ${body}`);
  }
  const snaps = await res.json();
  if (!Array.isArray(snaps) || snaps.length === 0) {
    throw new Error('No snapshots available for the provided feed');
  }
  const snap = snaps[snaps.length - 1];
  const price = snap.Price ?? snap.price ?? snap.price ?? snap.price?.toString();
  if (!price) {
    throw new Error('Snapshot missing Price field');
  }
  return String(price);
}

async function main() {
  const price = await fetchLatestPrice();
  console.log(`Using latest price: ${price}`);

  const account = new wallet.Account(cfg.wif);
  const rpcClient = new rpc.RPCClient(cfg.rpcURL);

  const args = [sc.ContractParam.string(price)];
  const signers = [{ account: account.scriptHash, scopes: tx.WitnessScope.CalledByEntry }];

  const invocation = await rpcClient.invokeFunction(cfg.contractHash, cfg.contractMethod, args, undefined, signers);
  const systemFee = Math.ceil(Number(invocation.gasconsumed || 0));
  console.log(`Estimated system fee: ${systemFee} GAS`);
  console.log(`Network fee: ${cfg.networkFee} GAS`);

  const script = sc.createScript({
    scriptHash: cfg.contractHash,
    operation: cfg.contractMethod,
    args,
  });

  const transaction = new tx.Transaction({
    script,
    signers,
    systemFee: u.BigInteger.fromNumber(systemFee),
    networkFee: u.BigInteger.fromNumber(cfg.networkFee),
  });

  const version = await rpcClient.getVersion();
  transaction.sign(account, version.protocol.network);

  const accepted = await rpcClient.sendRawTransaction(transaction);
  console.log(`Submitted tx ${transaction.hash}: accepted=${accepted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

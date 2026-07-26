#!/usr/bin/env node
/**
 * Deployer-signer preflight for the Phase 1-3 contract deployment.
 *
 * Answers three questions before anyone spends GAS:
 *   1. Does the configured WIF decode to the account we expect to deploy from?
 *   2. Can it sign?
 *   3. Does it hold enough GAS for the run?
 *
 * The signer is read from the environment, never from this file. Audit finding
 * C-6 (2026-05-19) exists because a WIF was written into a tracked file and
 * reached git history, where it is now unrecoverable-from. `npm run
 * check:repo:secret-material` fails the build if a key is pasted back in.
 *
 * Configuration:
 *   NEO_TESTNET_WIF | DEPLOYER_WIF   deployer signer (required)
 *   NEO_TESTNET_RPC_URL | NEO_RPC_URL  RPC endpoint (required)
 *   NEO_TESTNET_ADDRESS              expected address (optional; verified if set)
 *
 * Usage:
 *   node scripts/deployment/validate-wif-key.mjs
 *   node scripts/deployment/validate-wif-key.mjs --min-gas 120
 */

import { rpc, u, wallet } from '@cityofzion/neon-js';

/** Native GAS token, consistent with framework/credits.ts GAS_TOKEN_HASH. */
const GAS_TOKEN_HASH = '0xd2a4cff31913016155e38e474a2c06d08be276cf';
const GAS_DECIMALS = 8;

/**
 * Read a required setting from the first environment variable that is set.
 *
 * @param {string[]} names
 * @param {string} purpose
 * @returns {string}
 */
function requireEnv(names, purpose) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  throw new Error(
    `Missing ${purpose}. Set one of: ${names.join(', ')}. See .env.example; ` +
      'do not hardcode key material in this repository.',
  );
}

/**
 * Parse `--min-gas <n>`. No default is invented: without it, the GAS balance is
 * reported but not judged, because this script has no basis for deciding how
 * much a given deployment costs.
 *
 * @param {string[]} argv
 * @returns {number|null}
 */
function parseMinGas(argv) {
  const index = argv.indexOf('--min-gas');
  if (index === -1) return null;
  const raw = argv[index + 1];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--min-gas expects a non-negative number, received: ${raw ?? '(nothing)'}`);
  }
  return parsed;
}

/**
 * Fetch the account's GAS balance as a decimal string.
 *
 * Reads the NEP-17 GAS balance, not unclaimed GAS: unclaimed GAS is the pending
 * NEO reward and is not spendable until claimed, so treating it as the
 * deployment budget would overstate what the account can actually pay.
 *
 * @param {import('@cityofzion/neon-js').rpc.RPCClient} client
 * @param {string} address
 * @returns {Promise<{raw: bigint, formatted: string}>}
 */
async function fetchGasBalance(client, address) {
  const response = await client.getNep17Balances(address);
  const entry = (response.balance ?? []).find(
    (item) => item.assethash.toLowerCase() === GAS_TOKEN_HASH.toLowerCase(),
  );
  const raw = BigInt(entry?.amount ?? '0');
  return { raw, formatted: u.BigInteger.fromNumber(raw.toString()).toDecimal(GAS_DECIMALS) };
}

async function validateDeployerSigner() {
  const wif = requireEnv(['NEO_TESTNET_WIF', 'DEPLOYER_WIF'], 'deployer WIF');
  const rpcUrl = requireEnv(['NEO_TESTNET_RPC_URL', 'NEO_RPC_URL'], 'Neo RPC endpoint');
  const minGas = parseMinGas(process.argv.slice(2));
  const expectedAddress = process.env.NEO_TESTNET_ADDRESS?.trim();

  const problems = [];

  // 1. Derive the account. Address and script hash are public; the public key
  //    and signature material are not printed, so this output is safe to paste
  //    into an issue or a CI log.
  const account = new wallet.Account(wif);
  console.log('Deployer account');
  console.log(`  address:     ${account.address}`);
  console.log(`  script hash: ${account.scriptHash}`);

  if (expectedAddress && expectedAddress !== account.address) {
    problems.push(
      `configured WIF derives ${account.address}, but NEO_TESTNET_ADDRESS is ${expectedAddress}`,
    );
  }

  // 2. Signing. A WIF that decodes but cannot produce a verifiable signature
  //    would fail mid-deployment instead of here.
  const probe = u.str2hexstring(`deployer-preflight:${account.address}`);
  const signature = wallet.sign(probe, account.privateKey);
  const signatureValid = wallet.verify(probe, signature, account.publicKey);
  console.log(`  can sign:    ${signatureValid ? 'yes' : 'no'}`);
  if (!signatureValid) {
    problems.push('signature produced by this key did not verify against its own public key');
  }

  // 3. Funding.
  console.log(`\nChain state (${rpcUrl})`);
  const client = new rpc.RPCClient(rpcUrl);
  let gasFormatted = null;
  try {
    const blockCount = await client.getBlockCount();
    console.log(`  block height: ${blockCount}`);
    const gas = await fetchGasBalance(client, account.address);
    gasFormatted = gas.formatted;
    console.log(`  GAS balance:  ${gas.formatted}`);

    if (minGas !== null) {
      const required = BigInt(Math.round(minGas * 10 ** GAS_DECIMALS));
      const sufficient = gas.raw >= required;
      console.log(`  required:     ${minGas} (${sufficient ? 'met' : 'NOT met'})`);
      if (!sufficient) {
        problems.push(`GAS balance ${gas.formatted} is below the required ${minGas}`);
      }
    }
  } catch (error) {
    // An unreachable node is a failed preflight, not a warning: the point of
    // this script is to establish that the deployer is funded.
    problems.push(`could not read chain state from ${rpcUrl}: ${error.message}`);
  }

  return {
    success: problems.length === 0,
    problems,
    account: { address: account.address, scriptHash: account.scriptHash },
    gas: gasFormatted,
    minGas,
  };
}

validateDeployerSigner()
  .then((result) => {
    if (result.success) {
      console.log('\nvalidate-wif-key: deployer signer ready');
      process.exit(0);
    }
    console.error('\nvalidate-wif-key: deployer signer NOT ready');
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exit(1);
  })
  .catch((error) => {
    console.error(`validate-wif-key: ${error.message}`);
    process.exit(1);
  });

/** Light testnet smoke for MiniAppSelfLoan (owner-path only; full lifecycle is covered
 *  by the local NeoVM TestEngine since the deployer holds no NEO). Owner sets the NEO
 *  price and funds the GAS pool, priming the contract for use. Testnet-pinned. */
import pkg from "@cityofzion/neon-js";
const { sc, wallet, rpc, tx, u } = pkg;
const RPC="https://rpc.t5.n3.nspcc.ru:20331", MAGIC=894710606;
const CONTRACT="0x87f94598c78cb954ca8200d3964ded9b584d7250";
const GAS="0xd2a4cff31913016155e38e474a2c06d08be276cf";
const A=new wallet.Account(process.env.NEO_TESTNET_WIF);
const c=new rpc.RPCClient(RPC), sleep=ms=>new Promise(r=>setTimeout(r,ms));
const retry=async f=>{for(let i=0;i<6;i++){try{return await f()}catch(e){if(i===5)throw e;await sleep(3000)}}};
const H=a=>sc.ContractParam.hash160(a), I=n=>sc.ContractParam.integer(n.toString()), S=s=>sc.ContractParam.string(s);
async function invoke(label,sh,op,args){
  const script=sc.createScript({scriptHash:sh,operation:op,args});
  const cnt=await retry(()=>c.getBlockCount());
  const signers=[tx.Signer.fromJson({account:"0x"+A.scriptHash,scopes:"CalledByEntry"})];
  const t=new tx.Transaction({signers,validUntilBlock:cnt+50,script});
  const inv=await retry(()=>c.invokeScript(u.HexString.fromHex(script),signers));
  if(inv.state!=="HALT")throw new Error(`${label} FAULT: ${inv.exception}`);
  t.systemFee=u.BigInteger.fromNumber(inv.gasconsumed); t.sign(A,MAGIC);
  t.networkFee=u.BigInteger.fromNumber(await retry(()=>c.calculateNetworkFee(t))); t.sign(A,MAGIC);
  const txid=await retry(()=>c.sendRawTransaction(t));
  for(let i=0;i<45;i++){await sleep(4000);let log;try{log=await c.getApplicationLog(txid)}catch{continue}
    const ex=log.executions?.[0]; if(ex?.vmstate==="HALT"){console.log(`  ${label} ✓ (${txid.slice(0,12)}…)`);return}
    throw new Error(`${label} FAULT: ${JSON.stringify(ex?.exception)}`);}
  throw new Error(`${label} not confirmed`);
}
async function read(m,p=[]){const r=await retry(()=>c.invokeFunction(CONTRACT,m,p));if(r.state!=="HALT")throw new Error(m+" FAULT");return r.stack[0]?.value}
(async()=>{
  console.log("contract:",CONTRACT,"\nowner/deployer:",A.address);
  console.log("\n[1] setNeoPrice(5 GAS per NEO)…");
  await invoke("setNeoPrice",CONTRACT,"setNeoPrice",[I(500000000)]);
  console.log("    neoPrice =",await read("neoPrice"),"(expect 500000000)");
  console.log("\n[2] fund pool 2 GAS…");
  await invoke("fundPool",GAS,"transfer",[H(A.scriptHash),H(CONTRACT),I(200000000),S("selfloan:fund")]);
  console.log("    pool =",await read("pool"),"(expect 200000000)");
  console.log("    feeBps =",await read("feeBps"),"| ltvTier2Bps =",await read("ltvTierBps",[{type:"Integer",value:"2"}]));
  console.log("\n✅ SELF-LOAN owner-path smoke OK (price set, pool funded); full lifecycle validated in TestEngine");
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});

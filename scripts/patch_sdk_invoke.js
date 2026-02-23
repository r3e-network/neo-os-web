const fs = require('fs');

const file = 'platform/sdk/src/client.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /async function invokeNeoLineInvocation\(invocation: InvocationIntent\): Promise<unknown> \{/,
  `async function invokeDirectInvocation(invocation: InvocationIntent): Promise<unknown> {
  const g = typeof window !== "undefined" ? window as unknown as WindowWithNeoLine : null;
  const address = await getInjectedWalletAddress();

  if (address.startsWith("0x") && g?.ethereum) {
    const data = "0x"; // Evm encoding placeholder
    return await g.ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from: address,
        to: invocation.contract_hash,
        data: data
      }]
    });
  }`
);

// We need to also replace the usage of invokeNeoLineInvocation -> invokeDirectInvocation
code = code.replace(/invokeNeoLineInvocation/g, 'invokeDirectInvocation');

fs.writeFileSync(file, code);

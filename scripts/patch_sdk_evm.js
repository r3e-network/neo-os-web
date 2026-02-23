const fs = require('fs');

const file = 'platform/sdk/src/client.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('ethereum')) {
  // Add EVM logic
  code = code.replace(
    /interface WindowWithNeoLine extends Window \{/,
    `interface WindowWithNeoLine extends Window {
  ethereum?: any;`
  );

  code = code.replace(
    /async function getInjectedWalletAddress\(\): Promise<string> \{/,
    `async function getInjectedWalletAddress(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("wallet.getAddress must be called in a browser context");
  }
  
  const g = window as unknown as WindowWithNeoLine;
  
  // Check EVM
  if (g.ethereum && typeof g.ethereum.request === "function") {
    try {
      const accounts = await g.ethereum.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) return accounts[0];
    } catch {}
  }
`
  );

  // Skip the rest of the old getInjectedWalletAddress start since we replaced the beginning
  code = code.replace(
    /  if \(!\("NEOLineN3" in window\)\) \{\n    throw new Error\("neo wallet not detected \(install NeoLine N3\) or host must bridge wallet\.getAddress"\);\n  \}\n  const g = window as unknown as WindowWithNeoLine;\n/g,
    ''
  );

  fs.writeFileSync(file, code);
}


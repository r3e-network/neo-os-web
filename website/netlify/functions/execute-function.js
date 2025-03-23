const { VM } = require('vm2');

exports.handler = async function(event, context) {
  try {
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
    
    const body = JSON.parse(event.body);
    const { code, args } = body;
    
    if (!code) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Code is required' })
      };
    }
    
    // Create a secure VM with limited capabilities
    const vm = new VM({
      timeout: 1000, // 1 second timeout
      sandbox: {
        console: {
          log: () => {},
          error: () => {},
          warn: () => {}
        },
        // Mock neo object for blockchain interactions
        neo: {
          getBalance: (address, token) => {
            return token === 'NEO' ? 42 : 18.5743;
          },
          getTransactions: (address, options = {}) => {
            return [
              { txid: "0xf999c936a7a221bfdf8d57ac22f3db1aa04a19716cdb45a675c976ca19fcb27a", type: "transfer", amount: 10, timestamp: "2023-06-15T08:42:31Z" },
              { txid: "0xe8be48f490ca80b13873e3f0dd711af172e827c4d17a5bb88e7217d63f6a978e", type: "claim", amount: 1.2, timestamp: "2023-06-14T16:29:15Z" }
            ].slice(0, options.limit || 10);
          },
          getBlockHeight: () => 1847392
        },
        // Mock secrets object
        secrets: {
          get: (key) => {
            return `mock_secret_for_${key}`;
          }
        },
        // Global fetch is not available in VM2, so we can mock it for demo purposes
        fetch: async (url) => {
          return {
            ok: true,
            json: async () => {
              if (url.includes('coingecko')) {
                return { neo: { usd: 11.42 } };
              }
              return { data: 'Mocked API response' };
            }
          };
        }
      }
    });
    
    // Add the function code to the VM
    vm.run(`${code}; globalThis.executeFn = main;`);
    
    // Execute the function with the provided args
    const startTime = Date.now();
    const result = vm.run(`executeFn(${JSON.stringify(args)})`);
    const executionTime = (Date.now() - startTime) / 1000;
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        data: result,
        executionTime 
      })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
};
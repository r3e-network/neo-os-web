package datafeed

// AggregatorV3ABI is the ABI for Chainlink's AggregatorV3Interface.
// Only includes the methods we need: latestRoundData() and decimals().
const AggregatorV3ABI = `[
	{
		"inputs": [],
		"name": "latestRoundData",
		"outputs": [
			{"internalType": "uint80", "name": "roundId", "type": "uint80"},
			{"internalType": "int256", "name": "answer", "type": "int256"},
			{"internalType": "uint256", "name": "startedAt", "type": "uint256"},
			{"internalType": "uint256", "name": "updatedAt", "type": "uint256"},
			{"internalType": "uint80", "name": "answeredInRound", "type": "uint80"}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "decimals",
		"outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "description",
		"outputs": [{"internalType": "string", "name": "", "type": "string"}],
		"stateMutability": "view",
		"type": "function"
	}
]`

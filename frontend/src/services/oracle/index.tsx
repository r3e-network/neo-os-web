import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { registerServicePlugin } from '../../context/ServiceContext';
import { WorkstationProps } from '../../types';

// Oracle Documentation Component
function OracleDocs() {
  return (
    <Box>
      <Card className="glass-card" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" mb={2}>
            Oracle Service Documentation
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            The Oracle Service provides reliable, tamper-proof price feeds and external data
            for smart contracts on the Neo blockchain. Powered by TEE technology for
            maximum security and reliability.
          </Typography>

          <Typography variant="h6" mb={2}>
            Features
          </Typography>
          <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
            <li>Real-time price feeds for 100+ cryptocurrency pairs</li>
            <li>Sub-second latency with TEE-verified data</li>
            <li>Historical price data access</li>
            <li>Custom data feed requests</li>
            <li>Webhook notifications for price thresholds</li>
          </Box>

          <Typography variant="h6" mt={3} mb={2}>
            Quick Start
          </Typography>
          <Box className="code-block" sx={{ mb: 3 }}>
            <code>
              {`import { ServiceLayerClient } from '@service-layer/sdk';

const client = new ServiceLayerClient({
  endpoint: 'https://api.servicelayer.io',
  apiKey: 'your-api-key'
});

// Get latest price
const price = await client.oracle.getPrice({
  pair: 'NEO/USD',
  source: 'aggregated'
});

console.log(\`NEO/USD: $\${price.value}\`);

// Subscribe to price updates
client.oracle.subscribe('NEO/USD', (update) => {
  console.log('Price update:', update);
});`}
            </code>
          </Box>

          <Typography variant="h6" mb={2}>
            Supported Price Pairs
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {['NEO/USD', 'GAS/USD', 'BTC/USD', 'ETH/USD', 'NEO/BTC', 'NEO/ETH'].map((pair) => (
              <Chip
                key={pair}
                label={pair}
                size="small"
                sx={{
                  backgroundColor: 'rgba(0, 229, 153, 0.1)',
                  color: '#00e599',
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// Oracle Workstation Component
function OracleWorkstation({ wallet }: WorkstationProps) {
  const [selectedPair, setSelectedPair] = useState('NEO/USD');
  const [loading, setLoading] = useState(false);
  const [priceData, setPriceData] = useState<{
    pair: string;
    price: number;
    change24h: number;
    timestamp: string;
  } | null>(null);

  const pricePairs = [
    'NEO/USD', 'GAS/USD', 'BTC/USD', 'ETH/USD',
    'NEO/BTC', 'NEO/ETH', 'GAS/NEO', 'USDT/USD'
  ];

  // Mock price data
  const mockPrices: Record<string, { price: number; change: number }> = {
    'NEO/USD': { price: 12.45, change: 2.34 },
    'GAS/USD': { price: 4.82, change: -1.23 },
    'BTC/USD': { price: 43250.00, change: 1.56 },
    'ETH/USD': { price: 2280.50, change: 0.89 },
    'NEO/BTC': { price: 0.000288, change: 0.78 },
    'NEO/ETH': { price: 0.00546, change: 1.45 },
    'GAS/NEO': { price: 0.387, change: -0.34 },
    'USDT/USD': { price: 1.0001, change: 0.01 },
  };

  const fetchPrice = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const mock = mockPrices[selectedPair];
    setPriceData({
      pair: selectedPair,
      price: mock.price,
      change24h: mock.change,
      timestamp: new Date().toISOString(),
    });
    setLoading(false);
  };

  return (
    <Box>
      {!wallet.connected && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Connect your wallet to access premium Oracle features
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Price Query */}
        <Card className="glass-card">
          <CardContent>
            <Typography variant="h6" mb={3}>
              Query Price Feed
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Price Pair</InputLabel>
              <Select
                value={selectedPair}
                label="Price Pair"
                onChange={(e) => setSelectedPair(e.target.value)}
              >
                {pricePairs.map((pair) => (
                  <MenuItem key={pair} value={pair}>
                    {pair}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              fullWidth
              onClick={fetchPrice}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              sx={{
                background: 'linear-gradient(90deg, #00e599, #00b377)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #00b377, #009966)',
                },
              }}
            >
              {loading ? 'Fetching...' : 'Get Price'}
            </Button>

            {priceData && (
              <Box sx={{ mt: 3, p: 2, borderRadius: 2, backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  {priceData.pair}
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  ${priceData.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mt={1}>
                  <TrendingUpIcon
                    sx={{
                      color: priceData.change24h >= 0 ? '#00e599' : '#ff4757',
                      transform: priceData.change24h < 0 ? 'rotate(180deg)' : 'none',
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: priceData.change24h >= 0 ? '#00e599' : '#ff4757' }}
                  >
                    {priceData.change24h >= 0 ? '+' : ''}{priceData.change24h}%
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  Updated: {new Date(priceData.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Live Prices Table */}
        <Card className="glass-card">
          <CardContent>
            <Typography variant="h6" mb={2}>
              Live Price Feeds
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Pair</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">24h Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(mockPrices).slice(0, 6).map(([pair, data]) => (
                    <TableRow key={pair}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {pair}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ color: data.change >= 0 ? '#00e599' : '#ff4757' }}
                        >
                          {data.change >= 0 ? '+' : ''}{data.change}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

// Register the Oracle plugin
registerServicePlugin({
  serviceId: 'oracle',
  name: 'Oracle Service',
  description: 'Decentralized price feeds and external data for smart contracts',
  icon: TrendingUpIcon,
  DocsComponent: OracleDocs,
  WorkstationComponent: OracleWorkstation,
});

export { OracleDocs, OracleWorkstation };

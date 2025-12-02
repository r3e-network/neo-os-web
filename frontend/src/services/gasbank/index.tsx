import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
} from '@mui/material';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SendIcon from '@mui/icons-material/Send';
import { registerServicePlugin } from '../../context/ServiceContext';
import { WorkstationProps } from '../../types';

// GasBank Documentation Component
function GasBankDocs() {
  return (
    <Box>
      <Card className="glass-card" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" mb={2}>
            GasBank Service Documentation
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            The GasBank Service provides gas sponsorship and management for smart contract
            operations on the Neo blockchain. Enable gasless transactions for your users
            and manage gas budgets efficiently.
          </Typography>

          <Typography variant="h6" mb={2}>
            Features
          </Typography>
          <Box component="ul" sx={{ pl: 2, color: 'text.secondary', mb: 3 }}>
            <li>Gasless transactions for end users</li>
            <li>Gas budget management and limits</li>
            <li>Per-contract and per-user gas allocation</li>
            <li>Real-time gas usage analytics</li>
            <li>Automatic gas refill policies</li>
          </Box>

          <Typography variant="h6" mb={2}>
            Quick Start
          </Typography>
          <Box className="code-block" sx={{ mb: 3 }}>
            <code>
              {`import { ServiceLayerClient } from '@service-layer/sdk';

const client = new ServiceLayerClient({
  endpoint: 'https://api.servicelayer.io',
  apiKey: 'your-api-key'
});

// Create a gas bank account
const account = await client.gasbank.createAccount({
  name: 'My DApp Gas Account',
  initialDeposit: '100', // GAS tokens
  dailyLimit: '10'
});

// Sponsor a transaction
const result = await client.gasbank.sponsorTransaction({
  accountId: account.id,
  transaction: signedTx,
  maxGas: '1'
});

// Check balance
const balance = await client.gasbank.getBalance(account.id);
console.log('Remaining GAS:', balance.available);`}
            </code>
          </Box>

          <Typography variant="h6" mb={2}>
            Pricing Tiers
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tier</TableCell>
                  <TableCell>Monthly Volume</TableCell>
                  <TableCell>Fee</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Starter</TableCell>
                  <TableCell>Up to 1,000 GAS</TableCell>
                  <TableCell>2%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Growth</TableCell>
                  <TableCell>1,000 - 10,000 GAS</TableCell>
                  <TableCell>1.5%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Enterprise</TableCell>
                  <TableCell>10,000+ GAS</TableCell>
                  <TableCell>1%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

// GasBank Workstation Component
function GasBankWorkstation({ wallet }: WorkstationProps) {
  const [depositAmount, setDepositAmount] = useState('10');
  const [dailyLimit, setDailyLimit] = useState(5);
  const [loading, setLoading] = useState(false);

  // Mock account data
  const [account] = useState({
    id: 'gb_demo_account',
    name: 'Demo Gas Account',
    balance: 45.67,
    dailyLimit: 10,
    usedToday: 3.24,
    totalSponsored: 1247,
    createdAt: '2024-01-15',
  });

  const recentTransactions = [
    { id: 'tx1', type: 'Deposit', amount: 50, timestamp: '2024-03-15 14:30', status: 'completed' },
    { id: 'tx2', type: 'Sponsor', amount: -0.5, timestamp: '2024-03-15 14:25', status: 'completed' },
    { id: 'tx3', type: 'Sponsor', amount: -0.3, timestamp: '2024-03-15 14:20', status: 'completed' },
    { id: 'tx4', type: 'Sponsor', amount: -0.8, timestamp: '2024-03-15 14:15', status: 'completed' },
    { id: 'tx5', type: 'Sponsor', amount: -0.2, timestamp: '2024-03-15 14:10', status: 'completed' },
  ];

  const handleDeposit = async () => {
    if (!wallet.connected) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
  };

  const usagePercentage = (account.usedToday / account.dailyLimit) * 100;

  return (
    <Box>
      {!wallet.connected && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Connect your wallet to manage your GasBank account
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        {/* Account Overview */}
        <Card className="glass-card">
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: 'rgba(0, 229, 153, 0.1)',
                }}
              >
                <AccountBalanceIcon sx={{ color: 'primary.main' }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  {account.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ID: {account.id}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Available Balance
              </Typography>
              <Typography variant="h3" fontWeight={700} sx={{ color: 'primary.main' }}>
                {account.balance.toFixed(2)} <Typography component="span" variant="h6">GAS</Typography>
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Daily Usage
                </Typography>
                <Typography variant="body2">
                  {account.usedToday.toFixed(2)} / {account.dailyLimit} GAS
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={usagePercentage}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    background: usagePercentage > 80
                      ? 'linear-gradient(90deg, #ff6b6b, #ff4757)'
                      : 'linear-gradient(90deg, #00e599, #7b61ff)',
                    borderRadius: 4,
                  },
                }}
              />
            </Box>

            <Box display="flex" gap={2}>
              <Box sx={{ flex: 1, p: 2, borderRadius: 2, backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
                <Typography variant="caption" color="text.secondary">
                  Total Sponsored
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {account.totalSponsored}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, p: 2, borderRadius: 2, backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
                <Typography variant="caption" color="text.secondary">
                  Active Since
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {account.createdAt}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Deposit & Settings */}
        <Card className="glass-card">
          <CardContent>
            <Typography variant="h6" mb={3}>
              Deposit GAS
            </Typography>

            <TextField
              fullWidth
              label="Amount (GAS)"
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: <Typography color="text.secondary">GAS</Typography>,
              }}
            />

            <Button
              variant="contained"
              fullWidth
              onClick={handleDeposit}
              disabled={loading || !wallet.connected}
              startIcon={<SendIcon />}
              sx={{
                mb: 4,
                background: 'linear-gradient(90deg, #00e599, #00b377)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #00b377, #009966)',
                },
              }}
            >
              {loading ? 'Processing...' : 'Deposit'}
            </Button>

            <Typography variant="h6" mb={2}>
              Daily Limit
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={dailyLimit}
                onChange={(_, value) => setDailyLimit(value as number)}
                min={1}
                max={50}
                marks={[
                  { value: 1, label: '1' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                ]}
                valueLabelDisplay="on"
                valueLabelFormat={(value) => `${value} GAS`}
                sx={{
                  '& .MuiSlider-thumb': {
                    backgroundColor: 'primary.main',
                  },
                  '& .MuiSlider-track': {
                    background: 'linear-gradient(90deg, #00e599, #7b61ff)',
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="glass-card" sx={{ gridColumn: { lg: 'span 2' } }}>
          <CardContent>
            <Typography variant="h6" mb={2}>
              Recent Transactions
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Chip
                          label={tx.type}
                          size="small"
                          sx={{
                            backgroundColor: tx.type === 'Deposit'
                              ? 'rgba(0, 229, 153, 0.2)'
                              : 'rgba(123, 97, 255, 0.2)',
                            color: tx.type === 'Deposit' ? '#00e599' : '#7b61ff',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ color: tx.amount > 0 ? '#00e599' : 'text.primary' }}
                        >
                          {tx.amount > 0 ? '+' : ''}{tx.amount} GAS
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {tx.timestamp}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={tx.status}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(0, 229, 153, 0.2)',
                            color: '#00e599',
                          }}
                        />
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

// Register the GasBank plugin
registerServicePlugin({
  serviceId: 'gasbank',
  name: 'GasBank Service',
  description: 'Gas sponsorship and management for smart contracts',
  icon: LocalGasStationIcon,
  DocsComponent: GasBankDocs,
  WorkstationComponent: GasBankWorkstation,
});

export { GasBankDocs, GasBankWorkstation };

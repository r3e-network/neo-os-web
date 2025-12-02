import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  LinearProgress,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import ApiIcon from '@mui/icons-material/Api';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useWallet } from '../context/WalletContext';

export default function AccountPage() {
  const { wallet, connect, disconnect, isConnecting } = useWallet();

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
    }
  };

  // Mock data for connected state
  const accountStats = {
    totalRequests: 12847,
    monthlyRequests: 3421,
    monthlyLimit: 10000,
    apiKeys: 2,
    services: ['Oracle', 'VRF', 'Automation'],
  };

  const recentActivity = [
    { service: 'Oracle', action: 'Price Feed Query', time: '2 min ago', status: 'success' },
    { service: 'VRF', action: 'Random Number Request', time: '15 min ago', status: 'success' },
    { service: 'Automation', action: 'Job Triggered', time: '1 hour ago', status: 'success' },
    { service: 'Oracle', action: 'Price Feed Query', time: '2 hours ago', status: 'success' },
    { service: 'Functions', action: 'Execution Complete', time: '3 hours ago', status: 'failed' },
  ];

  if (!wallet.connected) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={1}>
          Account
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Connect your wallet to view your account
        </Typography>

        <Card className="glass-card" sx={{ maxWidth: 500, mx: 'auto', textAlign: 'center', py: 6 }}>
          <CardContent>
            <AccountBalanceWalletIcon
              sx={{ fontSize: 64, color: 'text.secondary', mb: 3 }}
            />
            <Typography variant="h5" fontWeight={600} mb={2}>
              Connect Your Wallet
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>
              Connect your Neo wallet to access your account dashboard, view usage statistics,
              and manage your API keys.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={connect}
              disabled={isConnecting}
              sx={{
                background: 'linear-gradient(90deg, #00e599, #00b377)',
                px: 4,
                '&:hover': {
                  background: 'linear-gradient(90deg, #00b377, #009966)',
                },
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} mb={1}>
          Account
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your Service Layer account and settings
        </Typography>
      </Box>

      {/* Wallet Info */}
      <Card className="glass-card" sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: 'rgba(0, 229, 153, 0.1)',
                }}
              >
                <AccountBalanceWalletIcon sx={{ color: 'primary.main' }} />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Connected Wallet
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body1" fontWeight={600} fontFamily="monospace">
                    {wallet.address?.slice(0, 8)}...{wallet.address?.slice(-8)}
                  </Typography>
                  <Button
                    size="small"
                    onClick={copyAddress}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </Button>
                </Box>
              </Box>
            </Box>
            <Box display="flex" gap={2}>
              <Chip
                label={wallet.network || 'MainNet'}
                size="small"
                sx={{
                  backgroundColor: 'rgba(0, 229, 153, 0.2)',
                  color: '#00e599',
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={disconnect}
                sx={{
                  borderColor: 'rgba(255, 71, 87, 0.5)',
                  color: '#ff4757',
                  '&:hover': {
                    borderColor: '#ff4757',
                    backgroundColor: 'rgba(255, 71, 87, 0.1)',
                  },
                }}
              >
                Disconnect
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Usage Stats */}
        <Card className="glass-card">
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <ApiIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600}>
                Usage Statistics
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Monthly Requests
                </Typography>
                <Typography variant="body2">
                  {accountStats.monthlyRequests.toLocaleString()} / {accountStats.monthlyLimit.toLocaleString()}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(accountStats.monthlyRequests / accountStats.monthlyLimit) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg, #00e599, #7b61ff)',
                    borderRadius: 4,
                  },
                }}
              />
            </Box>

            <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="body2" color="text.secondary">
                Total Requests (All Time)
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {accountStats.totalRequests.toLocaleString()}
              </Typography>
            </Box>

            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="body2" color="text.secondary">
                Active API Keys
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {accountStats.apiKeys}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Active Services
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {accountStats.services.map((service) => (
                  <Chip
                    key={service}
                    label={service}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(123, 97, 255, 0.2)',
                      color: '#7b61ff',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-card">
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <HistoryIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600}>
                Recent Activity
              </Typography>
            </Box>

            <List dense>
              {recentActivity.map((activity, index) => (
                <Box key={index}>
                  {index > 0 && (
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
                  )}
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight={500}>
                            {activity.service}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            - {activity.action}
                          </Typography>
                        </Box>
                      }
                      secondary={activity.time}
                    />
                    <Chip
                      label={activity.status}
                      size="small"
                      sx={{
                        backgroundColor:
                          activity.status === 'success'
                            ? 'rgba(0, 229, 153, 0.2)'
                            : 'rgba(255, 71, 87, 0.2)',
                        color: activity.status === 'success' ? '#00e599' : '#ff4757',
                      }}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass-card">
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <SettingsIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600}>
                Quick Actions
              </Typography>
            </Box>

            <List>
              <ListItem disablePadding sx={{ mb: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<ApiIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'rgba(0, 229, 153, 0.05)',
                    },
                  }}
                >
                  Manage API Keys
                </Button>
              </ListItem>
              <ListItem disablePadding sx={{ mb: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<SecurityIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'rgba(0, 229, 153, 0.05)',
                    },
                  }}
                >
                  Security Settings
                </Button>
              </ListItem>
              <ListItem disablePadding>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: 'rgba(0, 229, 153, 0.05)',
                    },
                  }}
                >
                  View Full History
                </Button>
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="glass-card">
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              Notifications
            </Typography>
            <Alert
              severity="info"
              sx={{
                backgroundColor: 'rgba(0, 180, 216, 0.1)',
                color: '#00b4d8',
                '& .MuiAlert-icon': {
                  color: '#00b4d8',
                },
              }}
            >
              Your monthly usage is at 34%. You have 6,579 requests remaining.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

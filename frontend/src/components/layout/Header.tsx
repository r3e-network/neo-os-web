import { AppBar, Toolbar, Typography, Button, Box, IconButton, Chip } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MenuIcon from '@mui/icons-material/Menu';
import { useWallet } from '../../context/WalletContext';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const { wallet, connect, disconnect, isConnecting } = useWallet();

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Services', path: '/services' },
    { label: 'Docs', path: '/docs' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {/* Left: Logo & Menu */}
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton
            color="inherit"
            onClick={onMenuClick}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #00e599 0%, #7b61ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              SL
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(90deg, #00e599, #7b61ff)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              Service Layer
            </Typography>
          </Link>
        </Box>

        {/* Center: Navigation */}
        <Box
          display={{ xs: 'none', md: 'flex' }}
          gap={1}
        >
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              sx={{
                color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                fontWeight: isActive(item.path) ? 600 : 400,
                '&:hover': {
                  color: 'primary.main',
                  backgroundColor: 'rgba(0, 229, 153, 0.08)',
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        {/* Right: Wallet Connection */}
        <Box display="flex" alignItems="center" gap={2}>
          {wallet.connected ? (
            <>
              <Chip
                label={wallet.network}
                size="small"
                sx={{
                  backgroundColor: 'rgba(0, 229, 153, 0.1)',
                  color: 'primary.main',
                  display: { xs: 'none', sm: 'flex' },
                }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AccountBalanceWalletIcon />}
                onClick={disconnect}
                sx={{
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'rgba(0, 229, 153, 0.08)',
                  },
                }}
              >
                {formatAddress(wallet.address!)}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={<AccountBalanceWalletIcon />}
              onClick={connect}
              disabled={isConnecting}
              sx={{
                background: 'linear-gradient(90deg, #00e599, #00b377)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #00b377, #009966)',
                },
              }}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

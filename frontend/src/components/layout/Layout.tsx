import { useState, ReactNode } from 'react';
import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

const DRAWER_WIDTH = 260;

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Header */}
      <Header onMenuClick={handleDrawerToggle} />

      {/* Sidebar - Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            backgroundColor: 'background.paper',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          },
        }}
      >
        <Sidebar onItemClick={() => setMobileOpen(false)} />
      </Drawer>

      {/* Sidebar - Desktop */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            backgroundColor: 'background.paper',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            top: 64,
            height: 'calc(100% - 64px)',
          },
        }}
        open
      >
        <Sidebar />
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          ml: { md: `${DRAWER_WIDTH}px` },
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: 'background.default',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

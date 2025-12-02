import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import { WalletProvider } from './context/WalletContext';
import { ServiceProvider } from './context/ServiceContext';
import './index.css';

// Import service plugins (auto-registers via registerServicePlugin)
import './services';

// Create dark theme for Service Layer
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00e599', // Neo green
      light: '#33eaad',
      dark: '#00b377',
    },
    secondary: {
      main: '#7b61ff', // Purple accent
      light: '#9581ff',
      dark: '#5a43cc',
    },
    background: {
      default: '#0a0a0f',
      paper: '#12121a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#a0a0b0',
    },
    error: {
      main: '#ff4757',
    },
    warning: {
      main: '#ffa502',
    },
    success: {
      main: '#00e599',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <WalletProvider>
          <ServiceProvider>
            <App />
          </ServiceProvider>
        </WalletProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

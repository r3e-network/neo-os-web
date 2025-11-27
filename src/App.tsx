import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { UserConsole, AdminConsole } from './components';
import { professionalTheme } from './styles/theme';

function App() {
  return (
    <ThemeProvider theme={professionalTheme}>
      <CssBaseline />
      <Router>
        <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/user" replace />} />
            <Route path="/user" element={<UserConsole />} />
            <Route path="/admin" element={<AdminConsole />} />
            <Route path="*" element={<Navigate to="/user" replace />} />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, useColorModeValue } from '@chakra-ui/react';

// Layouts
import DashboardLayout from './components/layouts/DashboardLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Functions from './pages/Functions';
import Secrets from './pages/Secrets';
import Automation from './pages/Automation';
import PriceFeed from './pages/PriceFeed';
import RandomNumber from './pages/RandomNumber';
import Oracle from './pages/Oracle';
import GasBank from './pages/GasBank';
import Analytics from './pages/Analytics';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

// Auth context
import { AuthProvider, useAuth } from './context/AuthContext';

// WebSocket context
import { WebSocketProvider } from './context/WebSocketContext';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Admin route component (only for users with admin role)
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.roles?.some(role => role.name === 'admin');
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  
  return (
    <AuthProvider>
      <WebSocketProvider>
        <Box bg={bgColor} minH="100vh">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="functions" element={<Functions />} />
              <Route path="secrets" element={<Secrets />} />
              <Route path="automation" element={<Automation />} />
              <Route path="price-feed" element={<PriceFeed />} />
              <Route path="random" element={<RandomNumber />} />
              <Route path="oracle" element={<Oracle />} />
              <Route path="gas-bank" element={<GasBank />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="profile" element={<Profile />} />
              
              {/* Admin routes */}
              <Route path="users" element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              } />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App; 
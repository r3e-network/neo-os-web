import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/common/LoadingSpinner';

// Lazy load pages for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const ServiceHubPage = lazy(() => import('./pages/ServiceHubPage'));
const ServicePage = lazy(() => import('./pages/ServicePage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));

function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Home - Landing page */}
          <Route path="/" element={<HomePage />} />

          {/* Service Hub - All services listing */}
          <Route path="/services" element={<ServiceHubPage />} />

          {/* Individual Service Pages */}
          <Route path="/services/:serviceId" element={<ServicePage />} />
          <Route path="/services/:serviceId/:tab" element={<ServicePage />} />

          {/* Documentation */}
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/:section" element={<DocsPage />} />

          {/* Account Management */}
          <Route path="/account" element={<AccountPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;

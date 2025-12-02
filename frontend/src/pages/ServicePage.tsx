import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Chip,
  Button,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import TerminalIcon from '@mui/icons-material/Terminal';
import SettingsIcon from '@mui/icons-material/Settings';
import { useServices } from '../context/ServiceContext';
import { useWallet } from '../context/WalletContext';
import { WalletState } from '../types';

// Default Workstation Component
function DefaultWorkstation({ serviceName }: { serviceName: string }) {
  const { wallet } = useWallet();

  return (
    <Box>
      {!wallet.connected && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Connect your wallet to interact with {serviceName}
        </Alert>
      )}
      <Card className="glass-card">
        <CardContent>
          <Typography variant="h6" mb={2}>
            {serviceName} Workstation
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            This is the default workstation interface. Service-specific workstations
            can be implemented by registering a plugin for this service.
          </Typography>
          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              textAlign: 'center',
            }}
          >
            <TerminalIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Workstation interface coming soon
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// Default Documentation Component
function DefaultDocs({ serviceName, description }: { serviceName: string; description: string }) {
  return (
    <Box>
      <Card className="glass-card" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" mb={2}>
            {serviceName} Documentation
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            {description}
          </Typography>

          <Typography variant="h6" mb={2}>
            Getting Started
          </Typography>
          <Box className="code-block" sx={{ mb: 3 }}>
            <code>
              {`// Install the SDK
npm install @service-layer/sdk

// Initialize the client
import { ServiceLayerClient } from '@service-layer/sdk';

const client = new ServiceLayerClient({
  endpoint: 'https://api.servicelayer.io',
  apiKey: 'your-api-key'
});

// Use the ${serviceName.toLowerCase().replace(' service', '')} service
const result = await client.${serviceName.toLowerCase().replace(' service', '')}.query({
  // your parameters
});`}
            </code>
          </Box>

          <Typography variant="h6" mb={2}>
            API Reference
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Full API documentation is available in the developer portal.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

// Default Settings Component
function DefaultSettings({ serviceName }: { serviceName: string }) {
  return (
    <Box>
      <Card className="glass-card">
        <CardContent>
          <Typography variant="h6" mb={2}>
            {serviceName} Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Service-specific settings will appear here when configured.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function ServicePage() {
  const { serviceId, tab } = useParams<{ serviceId: string; tab?: string }>();
  const navigate = useNavigate();
  const { getService, getPlugin } = useServices();
  const { wallet } = useWallet();
  const [activeTab, setActiveTab] = useState(tab || 'docs');

  const service = getService(serviceId || '');
  const plugin = getPlugin(serviceId || '');

  if (!service) {
    return (
      <Box textAlign="center" py={8}>
        <Typography variant="h5" color="text.secondary" mb={2}>
          Service not found
        </Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/services')}
        >
          Back to Service Hub
        </Button>
      </Box>
    );
  }

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
    navigate(`/services/${serviceId}/${newValue}`, { replace: true });
  };

  // Get components from plugin or use defaults
  const DocsComponent = plugin?.DocsComponent || (() => (
    <DefaultDocs serviceName={service.name} description={service.description} />
  ));
  const WorkstationComponent = plugin?.WorkstationComponent || (() => (
    <DefaultWorkstation serviceName={service.name} />
  ));

  const tabs = [
    { id: 'docs', label: 'Documentation', icon: <DescriptionIcon /> },
    { id: 'workstation', label: 'Workstation', icon: <TerminalIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
    ...(plugin?.customTabs || []).map((t) => ({
      id: t.id,
      label: t.label,
      icon: t.icon ? <t.icon /> : null,
    })),
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/services')}
          sx={{ mb: 2, color: 'text.secondary' }}
        >
          Back to Service Hub
        </Button>

        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Typography variant="h4" fontWeight={700}>
            {service.name}
          </Typography>
          <Chip
            label={service.status}
            size="small"
            sx={{
              backgroundColor:
                service.status === 'online'
                  ? 'rgba(0, 229, 153, 0.2)'
                  : 'rgba(255, 71, 87, 0.2)',
              color: service.status === 'online' ? '#00e599' : '#ff4757',
            }}
          />
          <Chip
            label={`v${service.version}`}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
          />
        </Box>

        <Typography variant="body1" color="text.secondary" mb={2}>
          {service.description}
        </Typography>

        {service.capabilities && (
          <Box display="flex" gap={1} flexWrap="wrap">
            {service.capabilities.map((cap) => (
              <Chip
                key={cap}
                label={cap}
                size="small"
                sx={{
                  backgroundColor: 'rgba(123, 97, 255, 0.2)',
                  color: '#7b61ff',
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: 48,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'primary.main',
            },
          }}
        >
          {tabs.map((t) => (
            <Tab
              key={t.id}
              value={t.id}
              label={t.label}
              icon={t.icon || undefined}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Box>
        {activeTab === 'docs' && <DocsComponent />}
        {activeTab === 'workstation' && <WorkstationComponent wallet={wallet} />}
        {activeTab === 'settings' && <DefaultSettings serviceName={service.name} />}
        {plugin?.customTabs?.map((t) =>
          activeTab === t.id ? <t.component key={t.id} /> : null
        )}
      </Box>
    </Box>
  );
}

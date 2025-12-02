import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, Chip } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import AppsIcon from '@mui/icons-material/Apps';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import { useServices } from '../../context/ServiceContext';

interface SidebarProps {
  onItemClick?: () => void;
}

export default function Sidebar({ onItemClick }: SidebarProps) {
  const location = useLocation();
  const { services } = useServices();

  const mainNavItems = [
    { label: 'Home', path: '/', icon: <HomeIcon /> },
    { label: 'Service Hub', path: '/services', icon: <AppsIcon /> },
    { label: 'Documentation', path: '/docs', icon: <DescriptionIcon /> },
    { label: 'Account', path: '/account', icon: <PersonIcon /> },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, typeof services>);

  const categoryLabels: Record<string, string> = {
    oracle: 'Oracle Services',
    compute: 'Compute Services',
    data: 'Data Services',
    security: 'Security Services',
    privacy: 'Privacy Services',
    'cross-chain': 'Cross-Chain',
    utility: 'Utility Services',
  };

  return (
    <Box sx={{ pt: 2, pb: 2, height: '100%', overflow: 'auto' }}>
      {/* Main Navigation */}
      <List>
        {mainNavItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              onClick={onItemClick}
              selected={isActive(item.path)}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(0, 229, 153, 0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 153, 0.15)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Services by Category */}
      <Box sx={{ px: 2, mb: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600 }}>
          Services
        </Typography>
      </Box>

      {Object.entries(servicesByCategory).slice(0, 4).map(([category, categoryServices]) => (
        <Box key={category} sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 3, display: 'block', mb: 0.5 }}
          >
            {categoryLabels[category] || category}
          </Typography>
          <List dense>
            {categoryServices.slice(0, 3).map((service) => (
              <ListItem key={service.id} disablePadding>
                <ListItemButton
                  component={Link}
                  to={`/services/${service.id}`}
                  onClick={onItemClick}
                  selected={location.pathname === `/services/${service.id}`}
                  sx={{
                    mx: 1,
                    py: 0.5,
                    borderRadius: 1,
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(0, 229, 153, 0.1)',
                    },
                  }}
                >
                  <ListItemText
                    primary={service.name.replace(' Service', '')}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  <Chip
                    label={service.status}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      backgroundColor:
                        service.status === 'online'
                          ? 'rgba(0, 229, 153, 0.2)'
                          : 'rgba(255, 71, 87, 0.2)',
                      color:
                        service.status === 'online' ? '#00e599' : '#ff4757',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      ))}

      {/* View All Services Link */}
      <Box sx={{ px: 2, mt: 2 }}>
        <ListItemButton
          component={Link}
          to="/services"
          onClick={onItemClick}
          sx={{
            borderRadius: 2,
            border: '1px dashed rgba(255, 255, 255, 0.2)',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            View All Services →
          </Typography>
        </ListItemButton>
      </Box>

      {/* Footer */}
      <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, px: 2 }}>
        <Divider sx={{ mb: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
        <ListItemButton
          component={Link}
          to="/settings"
          sx={{ borderRadius: 2 }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText
            primary="Settings"
            primaryTypographyProps={{ variant: 'body2' }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );
}

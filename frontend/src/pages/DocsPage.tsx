import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CodeIcon from '@mui/icons-material/Code';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

interface DocSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  articles: { title: string; slug: string }[];
}

const docSections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of Service Layer',
    icon: <MenuBookIcon />,
    articles: [
      { title: 'Introduction to Service Layer', slug: 'introduction' },
      { title: 'Quick Start Guide', slug: 'quickstart' },
      { title: 'Architecture Overview', slug: 'architecture' },
      { title: 'Core Concepts', slug: 'concepts' },
    ],
  },
  {
    id: 'sdk',
    title: 'SDK & APIs',
    description: 'Integrate with our SDKs and APIs',
    icon: <CodeIcon />,
    articles: [
      { title: 'JavaScript/TypeScript SDK', slug: 'sdk-js' },
      { title: 'Go SDK', slug: 'sdk-go' },
      { title: 'REST API Reference', slug: 'api-rest' },
      { title: 'WebSocket API', slug: 'api-websocket' },
    ],
  },
  {
    id: 'services',
    title: 'Service Guides',
    description: 'Deep dive into each service',
    icon: <IntegrationInstructionsIcon />,
    articles: [
      { title: 'Oracle Service', slug: 'service-oracle' },
      { title: 'VRF Service', slug: 'service-vrf' },
      { title: 'Automation Service', slug: 'service-automation' },
      { title: 'Functions Service', slug: 'service-functions' },
      { title: 'Data Streams', slug: 'service-datastreams' },
      { title: 'CCIP Bridge', slug: 'service-ccip' },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Security best practices and TEE',
    icon: <SecurityIcon />,
    articles: [
      { title: 'TEE Overview', slug: 'tee-overview' },
      { title: 'Confidential Computing', slug: 'confidential-computing' },
      { title: 'Key Management', slug: 'key-management' },
      { title: 'Audit Reports', slug: 'audits' },
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'Optimization and scaling guides',
    icon: <SpeedIcon />,
    articles: [
      { title: 'Performance Tuning', slug: 'performance-tuning' },
      { title: 'Rate Limits', slug: 'rate-limits' },
      { title: 'Caching Strategies', slug: 'caching' },
      { title: 'Monitoring & Metrics', slug: 'monitoring' },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ & Support',
    description: 'Common questions and support',
    icon: <HelpOutlineIcon />,
    articles: [
      { title: 'Frequently Asked Questions', slug: 'faq' },
      { title: 'Troubleshooting', slug: 'troubleshooting' },
      { title: 'Community Resources', slug: 'community' },
      { title: 'Contact Support', slug: 'support' },
    ],
  },
];

export default function DocsPage() {
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const filteredSections = docSections.filter((section) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      section.title.toLowerCase().includes(searchLower) ||
      section.description.toLowerCase().includes(searchLower) ||
      section.articles.some((a) => a.title.toLowerCase().includes(searchLower))
    );
  });

  const currentSection = selectedSection
    ? docSections.find((s) => s.id === selectedSection)
    : null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} mb={1}>
          Documentation
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Everything you need to build with Service Layer
        </Typography>

        {/* Search */}
        <TextField
          placeholder="Search documentation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{
            maxWidth: 500,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Sidebar - Section List */}
        <Box sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
          <Card className="glass-card">
            <List>
              {filteredSections.map((section, index) => (
                <Box key={section.id}>
                  {index > 0 && (
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
                  )}
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={selectedSection === section.id}
                      onClick={() =>
                        setSelectedSection(
                          selectedSection === section.id ? null : section.id
                        )
                      }
                      sx={{
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(0, 229, 153, 0.1)',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ color: 'primary.main', minWidth: 40 }}>
                        {section.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={section.title}
                        secondary={`${section.articles.length} articles`}
                        primaryTypographyProps={{ fontWeight: 500 }}
                      />
                    </ListItemButton>
                  </ListItem>
                </Box>
              ))}
            </List>
          </Card>
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: 1 }}>
          {currentSection ? (
            // Selected Section View
            <Card className="glass-card">
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <Box sx={{ color: 'primary.main' }}>{currentSection.icon}</Box>
                  <Box>
                    <Typography variant="h5" fontWeight={600}>
                      {currentSection.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {currentSection.description}
                    </Typography>
                  </Box>
                </Box>

                <List>
                  {currentSection.articles.map((article, index) => (
                    <Box key={article.slug}>
                      {index > 0 && (
                        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
                      )}
                      <ListItem disablePadding>
                        <ListItemButton
                          sx={{
                            py: 2,
                            '&:hover': {
                              backgroundColor: 'rgba(0, 229, 153, 0.05)',
                            },
                          }}
                        >
                          <ListItemText
                            primary={article.title}
                            primaryTypographyProps={{ fontWeight: 500 }}
                          />
                          <Chip
                            label="Read"
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(0, 229, 153, 0.1)',
                              color: 'primary.main',
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          ) : (
            // Overview Grid
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 3,
              }}
            >
              {filteredSections.map((section) => (
                <Card
                  key={section.id}
                  className="glass-card"
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                    },
                  }}
                  onClick={() => setSelectedSection(section.id)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          backgroundColor: 'rgba(0, 229, 153, 0.1)',
                          color: 'primary.main',
                        }}
                      >
                        {section.icon}
                      </Box>
                      <Typography variant="h6" fontWeight={600}>
                        {section.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {section.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {section.articles.length} articles
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

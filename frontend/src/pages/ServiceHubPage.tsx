import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Link } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import { useServices } from '../context/ServiceContext';
import { ServiceCategory } from '../types';

const categoryLabels: Record<ServiceCategory, string> = {
  oracle: 'Oracle',
  compute: 'Compute',
  data: 'Data',
  security: 'Security',
  privacy: 'Privacy',
  'cross-chain': 'Cross-Chain',
  utility: 'Utility',
};

const categoryColors: Record<ServiceCategory, string> = {
  oracle: '#00e599',
  compute: '#7b61ff',
  data: '#00b4d8',
  security: '#ff6b6b',
  privacy: '#ffd93d',
  'cross-chain': '#6bcb77',
  utility: '#a0a0b0',
};

export default function ServiceHubPage() {
  const { services, loading } = useServices();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = useMemo(() => {
    const cats = new Set(services.map((s) => s.category));
    return Array.from(cats) as ServiceCategory[];
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        search === '' ||
        service.name.toLowerCase().includes(search.toLowerCase()) ||
        service.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || service.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, search, selectedCategory]);

  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, typeof services> = {};
    filteredServices.forEach((service) => {
      if (!grouped[service.category]) {
        grouped[service.category] = [];
      }
      grouped[service.category].push(service);
    });
    return grouped;
  }, [filteredServices]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} mb={1}>
          Service Hub
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explore and interact with all available services on the Service Layer
        </Typography>
      </Box>

      {/* Filters */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          mb: 4,
          alignItems: { md: 'center' },
          justifyContent: 'space-between',
        }}
      >
        {/* Search */}
        <TextField
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{
            width: { xs: '100%', md: 300 },
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

        {/* Category Filter */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label="All"
            onClick={() => setSelectedCategory('all')}
            sx={{
              backgroundColor:
                selectedCategory === 'all'
                  ? 'rgba(0, 229, 153, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
              color: selectedCategory === 'all' ? '#00e599' : 'text.secondary',
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 153, 0.3)',
              },
            }}
          />
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={categoryLabels[cat]}
              onClick={() => setSelectedCategory(cat)}
              sx={{
                backgroundColor:
                  selectedCategory === cat
                    ? `${categoryColors[cat]}33`
                    : 'rgba(255, 255, 255, 0.05)',
                color: selectedCategory === cat ? categoryColors[cat] : 'text.secondary',
                '&:hover': {
                  backgroundColor: `${categoryColors[cat]}44`,
                },
              }}
            />
          ))}

          {/* View Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
            size="small"
            sx={{ ml: 2 }}
          >
            <ToggleButton value="grid">
              <GridViewIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Services Grid/List */}
      {loading ? (
        <Typography color="text.secondary">Loading services...</Typography>
      ) : filteredServices.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            No services found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search or filters
          </Typography>
        </Box>
      ) : viewMode === 'grid' ? (
        // Grid View - Grouped by Category
        Object.entries(servicesByCategory).map(([category, categoryServices]) => (
          <Box key={category} sx={{ mb: 4 }}>
            <Typography
              variant="overline"
              sx={{
                color: categoryColors[category as ServiceCategory],
                fontWeight: 600,
                display: 'block',
                mb: 2,
              }}
            >
              {categoryLabels[category as ServiceCategory]} ({categoryServices.length})
            </Typography>
            <Grid container spacing={3}>
              {categoryServices.map((service) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={service.id}>
                  <Card
                    component={Link}
                    to={`/services/${service.id}`}
                    className="service-card glass-card"
                    sx={{
                      textDecoration: 'none',
                      display: 'block',
                      height: '100%',
                    }}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Box>
                          <Typography variant="h6" fontWeight={600} color="text.primary">
                            {service.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            v{service.version}
                          </Typography>
                        </Box>
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
                      </Box>
                      <Typography variant="body2" color="text.secondary" mb={2} sx={{ minHeight: 40 }}>
                        {service.description}
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {service.capabilities?.slice(0, 3).map((cap) => (
                          <Chip
                            key={cap}
                            label={cap}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: 'rgba(255, 255, 255, 0.2)',
                              color: 'text.secondary',
                              fontSize: '0.7rem',
                            }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))
      ) : (
        // List View
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredServices.map((service) => (
            <Card
              key={service.id}
              component={Link}
              to={`/services/${service.id}`}
              className="service-card glass-card"
              sx={{ textDecoration: 'none' }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ flex: 1 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      {service.name}
                    </Typography>
                    <Chip
                      label={categoryLabels[service.category]}
                      size="small"
                      sx={{
                        backgroundColor: `${categoryColors[service.category]}22`,
                        color: categoryColors[service.category],
                      }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {service.description}
                  </Typography>
                </Box>
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
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}

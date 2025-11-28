import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Rating,
  Badge,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ProfessionalCard, GradientButton, GlassContainer } from '../styles/styledComponents';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  ShoppingCart as CartIcon,
  Timeline as TimelineIcon,
  AttachMoney as MoneyIcon,
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Code as CodeIcon,
  DesignServices as DesignIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import useServiceStore from '../stores/serviceStore';
import { Service, ServiceRequest, ServiceCategory } from '../types/service';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const categoryIcons: Record<string, React.ReactNode> = {
  'consulting': <BusinessIcon />,
  'development': <CodeIcon />,
  'design': <DesignIcon />,
  'analytics': <AnalyticsIcon />,
  'security': <SecurityIcon />,
  'cloud': <CloudIcon />,
};

export default function UserConsole() {
  const [tabValue, setTabValue] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [newRequest, setNewRequest] = useState<Partial<ServiceRequest>>({
    details: {
      description: '',
      objectives: [],
      constraints: [],
    },
    priority: 'medium',
  });

  // Service Store State
  const {
    categories,
    featuredServices,
    popularServices,
    userRequests,
    userOrders,
    loading,
    error,
    searchQuery,
    selectedCategory,
    priceRange,
    selectedStatus,
    sortBy,
    sortOrder,
    filteredServices,
    setSearchQuery,
    setSelectedCategory,
    setPriceRange,
    setSelectedStatus,
    setSortBy,
    setSortOrder,
    clearFilters,
    addUserRequest,
    setServices,
    setCategories,
    setFeaturedServices,
    setPopularServices,
  } = useServiceStore();

  useEffect(() => {
    // Load initial data
    // This would typically come from your API
    const mockServices: Service[] = [
      {
        id: '1',
        name: 'Enterprise Blockchain Consulting',
        description: 'Comprehensive blockchain strategy and implementation consulting for enterprise organizations',
        category: {
          id: 'consulting',
          name: 'Consulting',
          description: 'Strategic consulting services',
          icon: 'business',
          color: '#1976d2',
        },
        status: 'active',
        pricing: {
          type: 'hourly',
          basePrice: 250,
          currency: 'USD',
        },
        features: [
          'Blockchain architecture design',
          'Smart contract development',
          'Tokenomics consulting',
          'Security audits',
          'Team training',
        ],
        requirements: [
          'Business requirements documentation',
          'Technical infrastructure assessment',
          'Stakeholder alignment',
        ],
        deliveryTime: '2-6 months',
        supportLevel: 'premium',
        metadata: {
          complexity: 'high',
          teamSize: 5,
          technologies: ['Ethereum', 'Solidity', 'IPFS', 'Chainlink'],
          industries: ['Finance', 'Supply Chain', 'Healthcare'],
          caseStudies: [],
          testimonials: [],
          ratings: {
            average: 4.8,
            totalReviews: 24,
            distribution: { 5: 18, 4: 5, 3: 1, 2: 0, 1: 0 },
          },
        },
        createdAt: '2024-01-15T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      },
      {
        id: '2',
        name: 'Smart Contract Development',
        description: 'Professional smart contract development and auditing services',
        category: {
          id: 'development',
          name: 'Development',
          description: 'Software development services',
          icon: 'code',
          color: '#388e3c',
        },
        status: 'active',
        pricing: {
          type: 'fixed',
          basePrice: 15000,
          currency: 'USD',
        },
        features: [
          'Custom smart contract development',
          'Comprehensive security audits',
          'Gas optimization',
          'Documentation and testing',
          'Deployment support',
        ],
        requirements: [
          'Detailed specifications',
          'Business logic requirements',
          'Security requirements',
        ],
        deliveryTime: '4-8 weeks',
        supportLevel: 'standard',
        metadata: {
          complexity: 'medium',
          teamSize: 3,
          technologies: ['Solidity', 'Vyper', 'Hardhat', 'Foundry'],
          industries: ['DeFi', 'NFT', 'Gaming'],
          caseStudies: [],
          testimonials: [],
          ratings: {
            average: 4.9,
            totalReviews: 42,
            distribution: { 5: 35, 4: 6, 3: 1, 2: 0, 1: 0 },
          },
        },
        createdAt: '2024-01-10T00:00:00Z',
        updatedAt: '2024-01-10T00:00:00Z',
      },
    ];

    const mockCategories: ServiceCategory[] = [
      {
        id: 'consulting',
        name: 'Consulting',
        description: 'Strategic consulting services',
        icon: 'business',
        color: '#1976d2',
      },
      {
        id: 'development',
        name: 'Development',
        description: 'Software development services',
        icon: 'code',
        color: '#388e3c',
      },
      {
        id: 'design',
        name: 'Design',
        description: 'UI/UX and visual design services',
        icon: 'design',
        color: '#f57c00',
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'Data analytics and insights',
        icon: 'analytics',
        color: '#7b1fa2',
      },
      {
        id: 'security',
        name: 'Security',
        description: 'Security and audit services',
        icon: 'security',
        color: '#d32f2f',
      },
      {
        id: 'cloud',
        name: 'Cloud',
        description: 'Cloud infrastructure services',
        icon: 'cloud',
        color: '#0288d1',
      },
    ];

    // Initialize store with mock data
    setServices(mockServices);
    setCategories(mockCategories);
    setFeaturedServices(mockServices.slice(0, 2));
    setPopularServices(mockServices.slice(0, 2));
    // In a real app, this would be API calls
  }, [setCategories, setFeaturedServices, setPopularServices, setServices]);

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setShowServiceDialog(true);
  };

  const handleRequestService = () => {
    if (selectedService) {
      setNewRequest({
        ...newRequest,
        serviceId: selectedService.id,
      });
      setShowServiceDialog(false);
      setShowRequestDialog(true);
    }
  };

  const handleSubmitRequest = () => {
    if (selectedService && newRequest.details?.description) {
      const request: ServiceRequest = {
        id: `req-${Date.now()}`,
        serviceId: selectedService.id,
        userId: 'current-user', // This would come from auth context
        status: 'submitted',
        priority: newRequest.priority || 'medium',
        details: newRequest.details as any,
        requirements: [],
        timeline: {
          milestones: [],
          flexibility: 'flexible',
        },
        budget: {
          minBudget: 0,
          maxBudget: 0,
          currency: 'USD',
          paymentSchedule: { type: 'milestone' },
        },
        attachments: [],
        communications: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addUserRequest(request);
      setShowRequestDialog(false);
      setNewRequest({
        details: {
          description: '',
          objectives: [],
          constraints: [],
        },
        priority: 'medium',
      });
    }
  };

  const ServiceCard = ({ service }: { service: Service }) => (
    <ProfessionalCard 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: 'pointer',
      }}
      onClick={() => handleServiceClick(service)}
    >
      <CardMedia
        component="div"
        sx={{
          height: 140,
          background: `linear-gradient(135deg, ${service.category.color}20, ${service.category.color}40)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          color: service.category.color,
        }}
      >
        {categoryIcons[service.category.icon] || <BusinessIcon />}
      </CardMedia>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
            {service.name}
          </Typography>
          <Chip 
            label={service.status} 
            size="small"
            color={service.status === 'active' ? 'success' : 'default'}
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
          {service.description}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Rating 
              value={service.metadata.ratings.average} 
              readOnly 
              size="small"
              precision={0.1}
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              ({service.metadata.ratings.totalReviews})
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" color="primary">
              {service.pricing.currency === 'USD' ? '$' : ''}{service.pricing.basePrice}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {service.pricing.type === 'hourly' ? '/hour' : service.pricing.type === 'subscription' ? '/month' : 'fixed'}
            </Typography>
          </Box>
          <Chip 
            label={service.deliveryTime} 
            size="small" 
            variant="outlined"
            icon={<TimelineIcon />}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Key Features:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {service.features.slice(0, 3).map((feature, index) => (
              <Chip key={index} label={feature} size="small" variant="outlined" />
            ))}
            {service.features.length > 3 && (
              <Chip label={`+${service.features.length - 3} more`} size="small" variant="outlined" />
            )}
          </Box>
        </Box>

        <Box sx={{ mt: 'auto' }}>
          <GradientButton
            fullWidth
            startIcon={<AddIcon />}
            onClick={(e) => {
              e.stopPropagation();
              handleServiceClick(service);
            }}
          >
            Request Service
          </GradientButton>
        </Box>
      </CardContent>
    </ProfessionalCard>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <GlassContainer sx={{ mb: 4, p: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Service Layer Console
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
          Discover and request professional services tailored to your needs
        </Typography>
      </GlassContainer>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <GlassContainer sx={{ mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '1rem',
              py: 2,
              minHeight: 64,
            },
            '& .MuiTab-iconWrapper': {
              fontSize: 24,
            },
          }}
        >
          <Tab label="Browse Services" icon={<SearchIcon />} />
          <Tab 
            label="My Requests" 
            icon={
              <Badge badgeContent={userRequests.length} color="primary">
                <CartIcon />
              </Badge>
            } 
          />
          <Tab 
            label="My Orders" 
            icon={
              <Badge badgeContent={userOrders.length} color="secondary">
                <TimelineIcon />
              </Badge>
            } 
          />
        </Tabs>
      </GlassContainer>

      {/* Browse Services Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Filters Sidebar */}
          <Grid size={{ xs: 12, md: 3 }}>
            <ProfessionalCard sx={{ p: 3, height: 'fit-content' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Filters</Typography>
                <IconButton onClick={clearFilters} size="small">
                  <ClearIcon />
                </IconButton>
              </Box>

              {/* Search */}
              <TextField
                fullWidth
                label="Search services"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                sx={{ mb: 3 }}
              />

              {/* Category Filter */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ mr: 1, color: category.color }}>
                          {categoryIcons[category.icon] || <BusinessIcon />}
                        </Box>
                        {category.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Status Filter */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedStatus || ''}
                  onChange={(e) => setSelectedStatus(e.target.value as any || null)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="coming-soon">Coming Soon</MenuItem>
                </Select>
              </FormControl>

              {/* Price Range */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Price Range: ${priceRange[0]} - ${priceRange[1]}
                </Typography>
                <Slider
                  value={priceRange}
                  onChange={(_, value) => setPriceRange(value as [number, number])}
                  valueLabelDisplay="auto"
                  min={0}
                  max={100000}
                  step={1000}
                />
              </Box>

              {/* Sort Options */}
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  label="Sort By"
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="price">Price</MenuItem>
                  <MenuItem value="rating">Rating</MenuItem>
                  <MenuItem value="popularity">Popularity</MenuItem>
                  <MenuItem value="newest">Newest</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  label="Order"
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>
            </ProfessionalCard>
          </Grid>

          {/* Services Grid */}
          <Grid size={{ xs: 12, md: 9 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Featured Services */}
                {featuredServices.length > 0 && (
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      Featured Services
                    </Typography>
                    <Grid container spacing={3}>
                      {featuredServices.map((service) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service.id}>
                          <ServiceCard service={service} />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Popular Services */}
                {popularServices.length > 0 && (
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                      Popular Services
                    </Typography>
                    <Grid container spacing={3}>
                      {popularServices.map((service) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service.id}>
                          <ServiceCard service={service} />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* All Services */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      All Services ({filteredServices().length})
                    </Typography>
                  </Box>
                  <Grid container spacing={3}>
                    {filteredServices().map((service) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service.id}>
                        <ServiceCard service={service} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {filteredServices().length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                      No services found matching your criteria
                    </Typography>
                    <GradientButton onClick={clearFilters}>
                      Clear Filters
                    </GradientButton>
                  </Box>
                )}
              </>
            )}
          </Grid>
        </Grid>
      </TabPanel>

      {/* My Requests Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {userRequests.length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <ProfessionalCard sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  You haven't submitted any service requests yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Browse our services and submit your first request to get started
                </Typography>
                <GradientButton
                  startIcon={<SearchIcon />}
                  onClick={() => setTabValue(0)}
                >
                  Browse Services
                </GradientButton>
              </ProfessionalCard>
            </Grid>
          ) : (
            userRequests.map((request) => (
              <Grid size={{ xs: 12, md: 6 }} key={request.id}>
                <ProfessionalCard sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6">
                      Request #{request.id.slice(-6)}
                    </Typography>
                    <Chip 
                      label={request.status} 
                      color={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'error' : 'default'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {request.details.description}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip label={request.priority} size="small" />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </ProfessionalCard>
              </Grid>
            ))
          )}
        </Grid>
      </TabPanel>

      {/* My Orders Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          {userOrders.length === 0 ? (
            <Grid size={{ xs: 12 }}>
              <ProfessionalCard sx={{ p: 6, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  You don't have any active orders
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Once your service requests are approved, they will appear here as orders
                </Typography>
                <GradientButton
                  startIcon={<CartIcon />}
                  onClick={() => setTabValue(1)}
                >
                  View My Requests
                </GradientButton>
              </ProfessionalCard>
            </Grid>
          ) : (
            userOrders.map((order) => (
              <Grid size={{ xs: 12 }} key={order.id}>
                <ProfessionalCard sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6">
                      Order #{order.id.slice(-6)}
                    </Typography>
                    <Chip 
                      label={order.status} 
                      color={order.status === 'completed' ? 'success' : order.status === 'cancelled' ? 'error' : 'primary'}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Total: ${order.pricing.totalAmount} {order.pricing.currency}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <GradientButton size="small" variant="outlined">
                      View Details
                    </GradientButton>
                    <GradientButton size="small" variant="outlined">
                      Track Progress
                    </GradientButton>
                  </Box>
                </ProfessionalCard>
              </Grid>
            ))
          )}
        </Grid>
      </TabPanel>

      {/* Service Detail Dialog */}
      <Dialog 
        open={showServiceDialog} 
        onClose={() => setShowServiceDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedService && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ fontSize: 32, color: selectedService.category.color }}>
                  {categoryIcons[selectedService.category.icon] || <BusinessIcon />}
                </Box>
                <Box>
                  <Typography variant="h5" component="div">
                    {selectedService.name}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary">
                    {selectedService.category.name}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {selectedService.description}
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Rating 
                    value={selectedService.metadata.ratings.average} 
                    readOnly 
                    precision={0.1}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({selectedService.metadata.ratings.totalReviews} reviews)
                  </Typography>
                </Box>

                <Chip 
                  label={selectedService.status} 
                  color={selectedService.status === 'active' ? 'success' : 'default'}
                  sx={{ mr: 1 }}
                />
                <Chip 
                  label={selectedService.deliveryTime} 
                  variant="outlined"
                  icon={<TimelineIcon />}
                />
              </Box>

              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Features & Deliverables</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {selectedService.features.map((feature, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={feature} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Requirements</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {selectedService.requirements.map((requirement, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={requirement} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Pricing</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <MoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h5" color="primary">
                      {selectedService.pricing.currency === 'USD' ? '$' : ''}{selectedService.pricing.basePrice}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {selectedService.pricing.type === 'hourly' ? '/hour' : 
                       selectedService.pricing.type === 'subscription' ? '/month' : 'fixed price'}
                    </Typography>
                  </Box>
                  {selectedService.pricing.tiers && (
                    <Typography variant="body2" color="text.secondary">
                      Multiple pricing tiers available
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Support & SLA</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Support Level:</strong> {selectedService.supportLevel}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Team Size:</strong> {selectedService.metadata.teamSize} professionals
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </DialogContent>
            <DialogActions>
              <GradientButton onClick={() => setShowServiceDialog(false)}>
                Close
              </GradientButton>
              <GradientButton 
                onClick={handleRequestService}
                startIcon={<AddIcon />}
              >
                Request This Service
              </GradientButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Request Service Dialog */}
      <Dialog 
        open={showRequestDialog} 
        onClose={() => setShowRequestDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Request Service
          {selectedService && (
            <Typography variant="subtitle1" color="text.secondary">
              {selectedService.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Project Description *
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Please describe your project requirements, objectives, and any specific details..."
              value={newRequest.details?.description || ''}
              onChange={(e) => setNewRequest({
                ...newRequest,
                details: {
                  ...newRequest.details,
                  description: e.target.value,
                }
              })}
              sx={{ mb: 2 }}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Priority Level
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newRequest.priority || 'medium'}
                onChange={(e) => setNewRequest({
                  ...newRequest,
                  priority: e.target.value as any,
                })}
                label="Priority"
              >
                <MenuItem value="low">Low - Flexible timeline</MenuItem>
                <MenuItem value="medium">Medium - Standard timeline</MenuItem>
                <MenuItem value="high">High - Accelerated timeline</MenuItem>
                <MenuItem value="urgent">Urgent - Immediate attention needed</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <GradientButton onClick={() => setShowRequestDialog(false)}>
            Cancel
          </GradientButton>
          <GradientButton 
            onClick={handleSubmitRequest}
            disabled={!newRequest.details?.description}
          >
            Submit Request
          </GradientButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

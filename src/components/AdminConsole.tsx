import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  CardContent,
  Typography,
  Button,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Badge,
} from '@mui/material';
import { ProfessionalCard, GradientButton, GlassContainer } from '../styles/styledComponents';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  AttachMoney as MoneyIcon,
  ExpandMore as ExpandMoreIcon,
  Business as BusinessIcon,
  Code as CodeIcon,
  DesignServices as DesignIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  HourglassEmpty as HourglassIcon,
  TrendingUp as TrendingIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import useServiceStore from '../stores/serviceStore';
import { Service, ServiceRequest, ServiceOrder } from '../types/service';

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

const statusColors: Record<string, string> = {
  'active': '#4caf50',
  'maintenance': '#ff9800',
  'deprecated': '#f44336',
  'coming-soon': '#2196f3',
};

const requestStatusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  'draft': 'default',
  'submitted': 'info',
  'under-review': 'warning',
  'approved': 'success',
  'rejected': 'error',
  'in-progress': 'warning',
  'completed': 'success',
  'cancelled': 'error',
};

const requestStatusButtonColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  'draft': 'primary',
  'submitted': 'info',
  'under-review': 'warning',
  'approved': 'success',
  'rejected': 'error',
  'in-progress': 'warning',
  'completed': 'success',
  'cancelled': 'error',
};

const orderStatusColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  'pending': 'warning',
  'confirmed': 'info',
  'in-progress': 'warning',
  'ready-for-review': 'info',
  'completed': 'success',
  'delivered': 'success',
  'cancelled': 'error',
};

const orderStatusButtonColors: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  'pending': 'warning',
  'confirmed': 'info',
  'in-progress': 'warning',
  'ready-for-review': 'info',
  'completed': 'success',
  'delivered': 'success',
  'cancelled': 'error',
};

export default function AdminConsole() {
  const [tabValue, setTabValue] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Service Store State
  const {
    services,
    categories,
    userRequests,
    userOrders,
    error,
    updateUserRequest,
    updateUserOrder,
  } = useServiceStore();

  // Mock analytics data
  const analyticsData = [
    { name: 'Jan', requests: 45, orders: 32, revenue: 125000 },
    { name: 'Feb', requests: 52, orders: 38, revenue: 142000 },
    { name: 'Mar', requests: 61, orders: 45, revenue: 168000 },
    { name: 'Apr', requests: 48, orders: 35, revenue: 138000 },
    { name: 'May', requests: 67, orders: 49, revenue: 185000 },
    { name: 'Jun', requests: 73, orders: 54, revenue: 201000 },
  ];

  const categoryData = [
    { name: 'Consulting', value: 35, color: '#1976d2' },
    { name: 'Development', value: 28, color: '#388e3c' },
    { name: 'Design', value: 15, color: '#f57c00' },
    { name: 'Analytics', value: 12, color: '#7b1fa2' },
    { name: 'Security', value: 10, color: '#d32f2f' },
  ];

  const requestStatusData = [
    { status: 'submitted', count: userRequests.filter(r => r.status === 'submitted').length },
    { status: 'under-review', count: userRequests.filter(r => r.status === 'under-review').length },
    { status: 'approved', count: userRequests.filter(r => r.status === 'approved').length },
    { status: 'in-progress', count: userRequests.filter(r => r.status === 'in-progress').length },
    { status: 'completed', count: userRequests.filter(r => r.status === 'completed').length },
  ];

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !filterStatus || service.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredRequests = userRequests.filter(request => {
    const matchesSearch = request.details.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !filterStatus || request.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredOrders = userOrders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !filterStatus || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setShowServiceDialog(true);
  };

  const handleRequestClick = (request: ServiceRequest) => {
    setSelectedRequest(request);
    setShowRequestDialog(true);
  };

  const handleOrderClick = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setShowOrderDialog(true);
  };

  const handleUpdateRequestStatus = (requestId: string, newStatus: string) => {
    updateUserRequest(requestId, { status: newStatus as any });
    setShowRequestDialog(false);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: string) => {
    updateUserOrder(orderId, { status: newStatus as any });
    setShowOrderDialog(false);
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
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h6" component="h3" sx={{ flexGrow: 1 }}>
            {service.name}
          </Typography>
          <Chip 
            label={service.status} 
            size="small"
            sx={{ 
              backgroundColor: statusColors[service.status],
              color: 'white',
            }}
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
          {service.description}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" color="primary">
            {service.pricing.currency === 'USD' ? '$' : ''}{service.pricing.basePrice}
          </Typography>
          <Chip 
            label={service.deliveryTime} 
            size="small" 
            variant="outlined"
            icon={<TimelineIcon />}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
          <GradientButton
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={(e) => {
              e.stopPropagation();
              setEditingService(service);
              setShowAddServiceDialog(true);
            }}
          >
            Edit
          </GradientButton>
          <GradientButton
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={(e) => {
              e.stopPropagation();
              // Handle delete
            }}
          >
            Delete
          </GradientButton>
        </Box>
      </CardContent>
    </ProfessionalCard>
  );

  const StatCard = ({ title, value, icon, color, trend }: any) => (
    <ProfessionalCard sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ color: color, mr: 2 }}>
            {icon}
          </Box>
          <Typography variant="h6" color="text.secondary">
            {title}
          </Typography>
        </Box>
        {trend && (
          <Box sx={{ color: trend > 0 ? 'success.main' : 'error.main' }}>
            <TrendingIcon />
          </Box>
        )}
      </Box>
      <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
        {value}
      </Typography>
      {trend && (
        <Typography variant="body2" color={trend > 0 ? 'success.main' : 'error.main'}>
          {trend > 0 ? '+' : ''}{trend}% from last month
        </Typography>
      )}
    </ProfessionalCard>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <GlassContainer sx={{ mb: 4, p: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            Admin Console
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
            Manage services, requests, and orders
          </Typography>
        </Box>
        <GradientButton
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingService(null);
            setShowAddServiceDialog(true);
          }}
        >
          Add New Service
        </GradientButton>
      </GlassContainer>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Analytics Dashboard */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Total Services"
              value={services.length}
              icon={<BusinessIcon />}
              color="#1976d2"
              trend={12}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Active Requests"
              value={userRequests.filter(r => r.status === 'submitted' || r.status === 'under-review').length}
              icon={<AssessmentIcon />}
              color="#388e3c"
              trend={8}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Active Orders"
              value={userOrders.filter(o => o.status === 'in-progress').length}
              icon={<TimelineIcon />}
              color="#f57c00"
              trend={-3}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Monthly Revenue"
              value={`$${(201000).toLocaleString()}`}
              icon={<MoneyIcon />}
              color="#7b1fa2"
              trend={15}
            />
          </Grid>
        </Grid>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 8 }}>
            <ProfessionalCard sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Performance Overview
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="requests" stroke="#1976d2" name="Requests" />
                  <Line type="monotone" dataKey="orders" stroke="#388e3c" name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            </ProfessionalCard>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ProfessionalCard sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Request Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={requestStatusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label
                  >
                    {requestStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#ccc'} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </ProfessionalCard>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ProfessionalCard sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Services by Category
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </ProfessionalCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ProfessionalCard sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Activity
              </Typography>
              <List dense>
                {userRequests.slice(0, 5).map((request) => (
                  <ListItem key={request.id} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: requestStatusColors[request.status] }}>
                        {request.status === 'approved' ? <CheckCircleIcon /> : 
                         request.status === 'rejected' ? <CancelIcon /> : <HourglassIcon />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`Request #${request.id.slice(-6)}`}
                      secondary={`${request.details.description.slice(0, 50)}... • ${new Date(request.createdAt).toLocaleDateString()}`}
                    />
                    <Chip 
                      label={request.status} 
                      size="small"
                      color={requestStatusColors[request.status]}
                    />
                  </ListItem>
                ))}
              </List>
            </ProfessionalCard>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Services Management Tab */}
      <TabPanel value={tabValue} index={1}>
        <ProfessionalCard sx={{ mb: 3 }}>
          <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ flexGrow: 1 }}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Filter by Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="deprecated">Deprecated</MenuItem>
                <MenuItem value="coming-soon">Coming Soon</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={() => { setSearchQuery(''); setFilterStatus(''); }}>
              <ClearIcon />
            </IconButton>
          </Box>
        </ProfessionalCard>

        <Grid container spacing={3}>
          {filteredServices.map((service) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service.id}>
              <ServiceCard service={service} />
            </Grid>
          ))}
        </Grid>

        {filteredServices.length === 0 && (
          <ProfessionalCard sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No services found matching your criteria
            </Typography>
          </ProfessionalCard>
        )}
      </TabPanel>

      {/* Requests Management Tab */}
      <TabPanel value={tabValue} index={2}>
        <ProfessionalCard>
          <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ flexGrow: 1 }}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Filter by Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="submitted">Submitted</MenuItem>
                <MenuItem value="under-review">Under Review</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={() => { setSearchQuery(''); setFilterStatus(''); }}>
              <ClearIcon />
            </IconButton>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Request ID</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id} hover onClick={() => handleRequestClick(request)}>
                    <TableCell>#{request.id.slice(-6)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={services.find(s => s.id === request.serviceId)?.name || 'Unknown Service'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {request.details.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={request.priority} 
                        size="small"
                        color={request.priority === 'urgent' ? 'error' : request.priority === 'high' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={request.status} 
                        size="small"
                        color={requestStatusColors[request.status]}
                      />
                    </TableCell>
                    <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleRequestClick(request); }}>
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredRequests.length === 0 && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No requests found matching your criteria
              </Typography>
            </Box>
          )}
        </ProfessionalCard>
      </TabPanel>

      {/* Orders Management Tab */}
      <TabPanel value={tabValue} index={3}>
        <ProfessionalCard>
          <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ flexGrow: 1 }}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Filter by Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="ready-for-review">Ready for Review</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="delivered">Delivered</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={() => { setSearchQuery(''); setFilterStatus(''); }}>
              <ClearIcon />
            </IconButton>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Request ID</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Total Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} hover onClick={() => handleOrderClick(order)}>
                    <TableCell>#{order.id.slice(-6)}</TableCell>
                    <TableCell>#{order.requestId.slice(-6)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={services.find(s => s.id === order.serviceId)?.name || 'Unknown Service'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        ${order.pricing.totalAmount.toLocaleString()} {order.pricing.currency}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={order.status} 
                        size="small"
                        color={orderStatusColors[order.status]}
                      />
                    </TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleOrderClick(order); }}>
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {filteredOrders.length === 0 && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No orders found matching your criteria
              </Typography>
            </Box>
          )}
        </ProfessionalCard>
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={4}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ProfessionalCard sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                General Settings
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Enable service requests"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Enable new user registrations"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="Require admin approval for new services"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Send email notifications"
                />
              </Box>
            </ProfessionalCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ProfessionalCard sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Notification Settings
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="New service requests"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Order status changes"
                />
                <FormControlLabel
                  control={<Switch />}
                  label="User account changes"
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="System alerts"
                />
              </Box>
            </ProfessionalCard>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <ProfessionalCard sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                System Information
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total Services:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{services.length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total Requests:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{userRequests.length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total Orders:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{userOrders.length}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">System Status:</Typography>
                  <Chip label="Operational" color="success" size="small" />
                </Box>
              </Box>
            </ProfessionalCard>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tabs Navigation */}
      <GlassContainer sx={{ mt: 4 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
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
          <Tab label="Dashboard" icon={<AssessmentIcon />} />
          <Tab label="Services" icon={<BusinessIcon />} />
          <Tab 
            label="Requests" 
            icon={
              <Badge badgeContent={userRequests.filter(r => r.status === 'submitted' || r.status === 'under-review').length} color="primary">
                <PeopleIcon />
              </Badge>
            } 
          />
          <Tab 
            label="Orders" 
            icon={
              <Badge badgeContent={userOrders.filter(o => o.status === 'in-progress').length} color="secondary">
                <TimelineIcon />
              </Badge>
            } 
          />
          <Tab label="Settings" icon={<SettingsIcon />} />
        </Tabs>
      </GlassContainer>

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
                
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Chip 
                    label={selectedService.status} 
                    sx={{ 
                      backgroundColor: statusColors[selectedService.status],
                      color: 'white',
                    }}
                  />
                  <Chip 
                    label={selectedService.deliveryTime} 
                    variant="outlined"
                    icon={<TimelineIcon />}
                  />
                </Box>
              </Box>

              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Features & Pricing</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Base Price:</strong> ${selectedService.pricing.basePrice} {selectedService.pricing.currency}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Pricing Type:</strong> {selectedService.pricing.type}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Features:</strong>
                  </Typography>
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
                  <Typography variant="h6">Requirements & Support</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Requirements:</strong>
                  </Typography>
                  <List dense>
                    {selectedService.requirements.map((requirement, index) => (
                      <ListItem key={index}>
                        <ListItemText primary={requirement} />
                      </ListItem>
                    ))}
                  </List>
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    <strong>Support Level:</strong> {selectedService.supportLevel}
                  </Typography>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Metadata & Analytics</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Complexity:</strong> {selectedService.metadata.complexity}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Team Size:</strong> {selectedService.metadata.teamSize} professionals
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Technologies:</strong> {selectedService.metadata.technologies.join(', ')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Industries:</strong> {selectedService.metadata.industries.join(', ')}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Rating:</strong> {selectedService.metadata.ratings.average}/5 ({selectedService.metadata.ratings.totalReviews} reviews)
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </DialogContent>
            <DialogActions>
              <GradientButton onClick={() => setShowServiceDialog(false)}>
                Close
              </GradientButton>
              <GradientButton 
                startIcon={<EditIcon />}
                onClick={() => {
                  setShowServiceDialog(false);
                  setEditingService(selectedService);
                  setShowAddServiceDialog(true);
                }}
              >
                Edit Service
              </GradientButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Request Detail Dialog */}
      <Dialog 
        open={showRequestDialog} 
        onClose={() => setShowRequestDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedRequest && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5">
                  Request #{selectedRequest.id.slice(-6)}
                </Typography>
                <Chip 
                  label={selectedRequest.status} 
                  color={requestStatusColors[selectedRequest.status]}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Service Details
                </Typography>
                <Chip 
                  label={services.find(s => s.id === selectedRequest.serviceId)?.name || 'Unknown Service'}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {selectedRequest.details.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Chip 
                    label={selectedRequest.priority} 
                    color={selectedRequest.priority === 'urgent' ? 'error' : selectedRequest.priority === 'high' ? 'warning' : 'default'}
                  />
                  <Chip 
                    label={new Date(selectedRequest.createdAt).toLocaleDateString()}
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Status Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {['submitted', 'under-review', 'approved', 'rejected', 'in-progress', 'completed'].map((status) => (
                    <Button
                      key={status}
                      variant={selectedRequest.status === status ? 'contained' : 'outlined'}
                      color={requestStatusButtonColors[status as keyof typeof requestStatusButtonColors]}
                      onClick={() => handleUpdateRequestStatus(selectedRequest.id, status)}
                      disabled={selectedRequest.status === status}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                    </Button>
                  ))}
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <GradientButton onClick={() => setShowRequestDialog(false)}>
                Close
              </GradientButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog 
        open={showOrderDialog} 
        onClose={() => setShowOrderDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedOrder && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5">
                  Order #{selectedOrder.id.slice(-6)}
                </Typography>
                <Chip 
                  label={selectedOrder.status} 
                  color={orderStatusColors[selectedOrder.status]}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Order Details
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Service:</strong> {services.find(s => s.id === selectedOrder.serviceId)?.name || 'Unknown Service'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Request ID:</strong> #{selectedOrder.requestId.slice(-6)}
                  </Typography>
                </Box>
                <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                  Total: ${selectedOrder.pricing.totalAmount.toLocaleString()} {selectedOrder.pricing.currency}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Status Management
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {['pending', 'confirmed', 'in-progress', 'ready-for-review', 'completed', 'delivered', 'cancelled'].map((status) => (
                    <Button
                      key={status}
                      variant={selectedOrder.status === status ? 'contained' : 'outlined'}
                      color={orderStatusButtonColors[status as keyof typeof orderStatusButtonColors]}
                      onClick={() => handleUpdateOrderStatus(selectedOrder.id, status)}
                      disabled={selectedOrder.status === status}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                    </Button>
                  ))}
                </Box>
              </Box>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Pricing Breakdown</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {selectedOrder.pricing.breakdown.map((item, index) => (
                      <ListItem key={index} divider>
                        <ListItemText
                          primary={item.item}
                          secondary={`${item.quantity} × ${item.unitPrice} = ${item.totalPrice}`}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          ${item.totalPrice}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </DialogContent>
            <DialogActions>
              <GradientButton onClick={() => setShowOrderDialog(false)}>
                Close
              </GradientButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Add/Edit Service Dialog */}
      <Dialog 
        open={showAddServiceDialog} 
        onClose={() => setShowAddServiceDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5">
            {editingService ? 'Edit Service' : 'Add New Service'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 2 }}>
            <TextField
              label="Service Name"
              defaultValue={editingService?.name || ''}
              fullWidth
            />
            <TextField
              label="Description"
              defaultValue={editingService?.description || ''}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                defaultValue={editingService?.category.id || ''}
                label="Category"
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                defaultValue={editingService?.status || 'active'}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="deprecated">Deprecated</MenuItem>
                <MenuItem value="coming-soon">Coming Soon</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Base Price"
              type="number"
              defaultValue={editingService?.pricing.basePrice || 0}
              fullWidth
            />
            <TextField
              label="Delivery Time"
              defaultValue={editingService?.deliveryTime || ''}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <GradientButton onClick={() => setShowAddServiceDialog(false)}>
            Cancel
          </GradientButton>
          <GradientButton 
            onClick={() => {
              // Handle save logic
              setShowAddServiceDialog(false);
            }}
          >
            {editingService ? 'Update' : 'Create'} Service
          </GradientButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Stack,
  Badge,
  SimpleGrid,
  useColorModeValue,
  CircularProgress,
  CircularProgressLabel,
} from '@chakra-ui/react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import TransactionsList from '../components/transactions/TransactionsList';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Mock data - replace with actual API calls
const mockServiceStatus = [
  { service: 'Functions', status: 'healthy', uptime: '99.9%', load: 42 },
  { service: 'Secrets', status: 'healthy', uptime: '99.8%', load: 18 },
  { service: 'Automation', status: 'healthy', uptime: '99.7%', load: 76 },
  { service: 'Price Feed', status: 'healthy', uptime: '100%', load: 89 },
  { service: 'Random', status: 'healthy', uptime: '99.9%', load: 35 },
  { service: 'Oracle', status: 'healthy', uptime: '99.5%', load: 64 },
  { service: 'Gas Bank', status: 'healthy', uptime: '100%', load: 22 },
  { service: 'TEE', status: 'degraded', uptime: '98.2%', load: 91 },
];

const Dashboard = () => {
  const [services, setServices] = useState(mockServiceStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalRequests: 1253,
    activeUsers: 48,
    functionExecutions: 764,
    averageResponseTime: 124,
  });
  
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  // Chart data for API requests
  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'API Requests',
        data: [65, 59, 80, 81, 56, 55, 72],
        borderColor: '#1fa5fe',
        backgroundColor: 'rgba(31, 165, 254, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Function Executions',
        data: [28, 48, 40, 19, 36, 27, 43],
        borderColor: '#5e09da',
        backgroundColor: 'rgba(94, 9, 218, 0.1)',
        tension: 0.4,
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Weekly Usage',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };
  
  // Load data on component mount
  useEffect(() => {
    // In a real app, fetch data from API
    // const fetchData = async () => {
    //   setIsLoading(true);
    //   try {
    //     const response = await axios.get('/api/v1/dashboard/stats');
    //     setStats(response.data.stats);
    //     setServices(response.data.services);
    //   } catch (error) {
    //     console.error('Error fetching dashboard data:', error);
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // 
    // fetchData();
    
    // Simulate loading for demo
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }, []);
  
  return (
    <Stack spacing={8}>
      <Heading size="lg">Dashboard</Heading>
      
      {/* Stats overview */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
        <StatCard
          title="Total Requests"
          value={stats.totalRequests}
          helpText="Last 24 hours"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          helpText="Currently online"
          isLoading={isLoading}
        />
        <StatCard
          title="Function Executions"
          value={stats.functionExecutions}
          helpText="Last 24 hours"
          isLoading={isLoading}
        />
        <StatCard
          title="Avg Response Time"
          value={`${stats.averageResponseTime} ms`}
          helpText="Last hour"
          isLoading={isLoading}
        />
      </SimpleGrid>
      
      {/* Usage chart and Transaction list grid */}
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
        {/* Usage chart */}
        <Box
          bg={cardBg}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
          p={6}
          boxShadow="sm"
          h="300px"
        >
          {isLoading ? (
            <Flex h="100%" align="center" justify="center">
              <CircularProgress isIndeterminate color="brand.500" />
            </Flex>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </Box>
        
        {/* Recent Transactions with real-time updates */}
        <Box>
          <TransactionsList limit={5} />
        </Box>
      </Grid>
      
      {/* Service status */}
      <Box
        bg={cardBg}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
        p={6}
        boxShadow="sm"
      >
        <Heading size="md" mb={4}>Service Status</Heading>
        <Grid
          templateColumns={{ base: 'repeat(1, 1fr)', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }}
          gap={6}
        >
          {services.map(service => (
            <ServiceCard
              key={service.service}
              service={service}
              isLoading={isLoading}
            />
          ))}
        </Grid>
      </Box>
    </Stack>
  );
};

// Stat Card Component
const StatCard = ({ title, value, helpText, isLoading }) => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  return (
    <Box
      bg={cardBg}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      p={6}
      boxShadow="sm"
    >
      <Stat>
        <StatLabel>{title}</StatLabel>
        {isLoading ? (
          <CircularProgress size="40px" isIndeterminate color="brand.500" mt={2} />
        ) : (
          <StatNumber fontSize="2xl">{value}</StatNumber>
        )}
        <StatHelpText>{helpText}</StatHelpText>
      </Stat>
    </Box>
  );
};

// Service Status Card Component
const ServiceCard = ({ service, isLoading }) => {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  // Determine badge color based on status
  const getBadgeColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'green';
      case 'degraded':
        return 'yellow';
      case 'outage':
        return 'red';
      default:
        return 'gray';
    }
  };
  
  return (
    <Box
      bg={cardBg}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      p={4}
      boxShadow="sm"
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontWeight="medium">{service.service}</Text>
        {isLoading ? (
          <CircularProgress size="20px" isIndeterminate color="brand.500" />
        ) : (
          <Badge colorScheme={getBadgeColor(service.status)}>
            {service.status}
          </Badge>
        )}
      </Flex>
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" color="gray.500">Uptime</Text>
        <Text fontSize="sm" fontWeight="medium">{service.uptime}</Text>
      </Flex>
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" color="gray.500">Load</Text>
        <CircularProgress value={service.load} size="30px" thickness="8px">
          <CircularProgressLabel fontSize="xs">{service.load}%</CircularProgressLabel>
        </CircularProgress>
      </Flex>
    </Box>
  );
};

export default Dashboard; 
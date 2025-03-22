import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  Select,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
  VStack,
  HStack,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Card,
  CardBody,
  CardHeader,
} from '@chakra-ui/react';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import axios from 'axios';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [serviceData, setServiceData] = useState({});
  const [transactionData, setTransactionData] = useState({});
  const [performanceData, setPerformanceData] = useState({});
  const [usageData, setUsageData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  useEffect(() => {
    // Fetch data for each analytics section
    fetchAnalyticsData();
  }, [timeRange]);
  
  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // In a production environment, these would be actual API calls
      // For now, we'll simulate the data loading with setTimeout
      
      setTimeout(() => {
        // Mock service usage data
        setServiceData({
          labels: ['Functions', 'Secrets', 'Automation', 'Price Feed', 'Random Number', 'Oracle', 'Gas Bank'],
          datasets: [
            {
              label: 'API Calls',
              data: [4500, 1800, 3200, 5600, 2300, 4100, 3700],
              backgroundColor: [
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 99, 132, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)',
                'rgba(255, 159, 64, 0.6)',
                'rgba(199, 199, 199, 0.6)',
              ],
              borderColor: [
                'rgba(54, 162, 235, 1)',
                'rgba(255, 99, 132, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)',
                'rgba(199, 199, 199, 1)',
              ],
              borderWidth: 1,
            },
          ],
        });
        
        // Mock transaction data
        const labels = timeRange === '24h' 
          ? [...Array(24)].map((_, i) => `${i}:00`) 
          : timeRange === '7d' 
            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            : [...Array(30)].map((_, i) => `Day ${i+1}`);
            
        setTransactionData({
          labels,
          datasets: [
            {
              label: 'Successful',
              data: labels.map(() => Math.floor(Math.random() * 100) + 50),
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 2,
              fill: true,
            },
            {
              label: 'Failed',
              data: labels.map(() => Math.floor(Math.random() * 20)),
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 2,
              fill: true,
            },
          ],
        });
        
        // Mock performance data
        setPerformanceData({
          labels: labels,
          datasets: [
            {
              label: 'Avg Response Time (ms)',
              data: labels.map(() => Math.floor(Math.random() * 200) + 100),
              backgroundColor: 'rgba(153, 102, 255, 0.2)',
              borderColor: 'rgba(153, 102, 255, 1)',
              borderWidth: 2,
            },
            {
              label: 'CPU Usage (%)',
              data: labels.map(() => Math.floor(Math.random() * 50) + 20),
              backgroundColor: 'rgba(255, 159, 64, 0.2)',
              borderColor: 'rgba(255, 159, 64, 1)',
              borderWidth: 2,
            },
          ],
        });
        
        // Mock usage breakdown data
        setUsageData({
          services: {
            labels: ['Functions', 'Secrets', 'Automation', 'Price Feed', 'Random Number', 'Oracle', 'Gas Bank'],
            datasets: [
              {
                data: [30, 10, 15, 20, 10, 10, 5],
                backgroundColor: [
                  '#36A2EB', // blue
                  '#FF6384', // pink
                  '#FFCE56', // yellow
                  '#4BC0C0', // turquoise
                  '#9966FF', // purple
                  '#FF9F40', // orange
                  '#C7C7C7', // gray
                ],
                hoverBackgroundColor: [
                  '#36A2EB',
                  '#FF6384',
                  '#FFCE56',
                  '#4BC0C0',
                  '#9966FF',
                  '#FF9F40',
                  '#C7C7C7',
                ],
              },
            ],
          },
          resources: {
            labels: ['TEE Processing', 'Blockchain Transactions', 'Database Operations', 'API Requests'],
            datasets: [
              {
                data: [40, 30, 20, 10],
                backgroundColor: [
                  '#36A2EB',
                  '#FF6384',
                  '#4BC0C0',
                  '#FFCE56',
                ],
                hoverBackgroundColor: [
                  '#36A2EB',
                  '#FF6384',
                  '#4BC0C0',
                  '#FFCE56',
                ],
              },
            ],
          },
        });
        
        setIsLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setIsLoading(false);
    }
  };
  
  const getChartOptions = (title) => {
    return {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: title,
          font: {
            size: 16,
          },
        },
      },
      maintainAspectRatio: false,
    };
  };
  
  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
    },
    maintainAspectRatio: false,
  };
  
  return (
    <Container maxW="container.xl" pt={5}>
      <Heading as="h1" size="xl" mb={6}>
        Advanced Analytics & Reporting
      </Heading>
      
      <HStack spacing={4} mb={4}>
        <Text fontWeight="bold">Time Range:</Text>
        <Select 
          value={timeRange} 
          onChange={(e) => setTimeRange(e.target.value)}
          width="150px"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </Select>
        <Button 
          colorScheme="blue" 
          onClick={fetchAnalyticsData}
          isLoading={isLoading}
        >
          Refresh
        </Button>
      </HStack>
      
      <Tabs variant="enclosed" colorScheme="blue">
        <TabList mb={4}>
          <Tab>Service Usage</Tab>
          <Tab>Transactions</Tab>
          <Tab>Performance</Tab>
          <Tab>Resource Utilization</Tab>
        </TabList>
        
        <TabPanels>
          {/* Service Usage Tab */}
          <TabPanel p={0}>
            <Grid 
              templateColumns={{ base: "1fr", lg: "1fr 1fr" }} 
              gap={6}
              p={4}
            >
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>API Calls by Service</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Bar 
                      data={serviceData} 
                      options={getChartOptions('Service Usage Distribution')} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Service Usage Breakdown</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Doughnut 
                      data={usageData.services} 
                      options={doughnutOptions} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={{ base: 1, lg: 2 }}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Service KPIs</Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
                  <ServiceStat 
                    label="Total API Calls" 
                    value="21,200" 
                    change="+12.5%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={true}
                  />
                  <ServiceStat 
                    label="Unique Users" 
                    value="387" 
                    change="+8.3%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={true}
                  />
                  <ServiceStat 
                    label="Avg. Response Time" 
                    value="156ms" 
                    change="-4.2%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={true}
                  />
                  <ServiceStat 
                    label="Error Rate" 
                    value="0.8%" 
                    change="-0.3%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={true}
                  />
                </SimpleGrid>
              </GridItem>
            </Grid>
          </TabPanel>
          
          {/* Transactions Tab */}
          <TabPanel p={0}>
            <Grid 
              templateColumns={{ base: "1fr", lg: "1fr 1fr" }} 
              gap={6}
              p={4}
            >
              <GridItem
                colSpan={{ base: 1, lg: 2 }}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Transaction Volume</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Line 
                      data={transactionData} 
                      options={getChartOptions('Transaction Volume Over Time')} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Transaction Status</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Pie 
                      data={{
                        labels: ['Confirmed', 'Pending', 'Failed', 'Expired'],
                        datasets: [{
                          data: [75, 15, 8, 2],
                          backgroundColor: [
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(199, 199, 199, 0.6)',
                          ],
                          borderColor: [
                            'rgba(75, 192, 192, 1)',
                            'rgba(255, 206, 86, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(199, 199, 199, 1)',
                          ],
                        }]
                      }} 
                      options={getChartOptions('Transaction Status Distribution')} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Transaction Type</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Doughnut 
                      data={{
                        labels: ['Contract Calls', 'Oracle Updates', 'Function Executions', 'Price Feed Updates', 'Random Number Gen'],
                        datasets: [{
                          data: [35, 20, 25, 15, 5],
                          backgroundColor: [
                            'rgba(54, 162, 235, 0.6)',
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(153, 102, 255, 0.6)',
                          ],
                          borderColor: [
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 99, 132, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(255, 206, 86, 1)',
                            'rgba(153, 102, 255, 1)',
                          ],
                        }]
                      }} 
                      options={doughnutOptions} 
                    />
                  )}
                </Box>
              </GridItem>
            </Grid>
          </TabPanel>
          
          {/* Performance Tab */}
          <TabPanel p={0}>
            <Grid 
              templateColumns={{ base: "1fr", lg: "1fr 1fr" }} 
              gap={6}
              p={4}
            >
              <GridItem
                colSpan={{ base: 1, lg: 2 }}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>System Performance</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Line 
                      data={performanceData} 
                      options={getChartOptions('System Performance Metrics')} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Service Response Times</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Bar 
                      data={{
                        labels: ['Functions', 'Secrets', 'Automation', 'Price Feed', 'Random Number', 'Oracle', 'Gas Bank'],
                        datasets: [
                          {
                            label: 'Avg Response Time (ms)',
                            data: [145, 85, 220, 180, 105, 250, 70],
                            backgroundColor: 'rgba(153, 102, 255, 0.6)',
                            borderColor: 'rgba(153, 102, 255, 1)',
                            borderWidth: 1,
                          },
                        ],
                      }} 
                      options={getChartOptions('Average Response Time by Service')} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Error Rates</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Bar 
                      data={{
                        labels: ['Functions', 'Secrets', 'Automation', 'Price Feed', 'Random Number', 'Oracle', 'Gas Bank'],
                        datasets: [
                          {
                            label: 'Error Rate (%)',
                            data: [1.2, 0.3, 0.9, 0.5, 0.7, 1.5, 0.2],
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1,
                          },
                        ],
                      }} 
                      options={getChartOptions('Error Rate by Service')} 
                    />
                  )}
                </Box>
              </GridItem>
            </Grid>
          </TabPanel>
          
          {/* Resource Utilization Tab */}
          <TabPanel p={0}>
            <Grid 
              templateColumns={{ base: "1fr", lg: "1fr 1fr" }} 
              gap={6}
              p={4}
            >
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Resource Utilization</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Doughnut 
                      data={usageData.resources} 
                      options={doughnutOptions} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={1}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Gas Consumption</Heading>
                <Box height="400px">
                  {!isLoading && (
                    <Line 
                      data={{
                        labels: timeRange === '24h' 
                          ? [...Array(24)].map((_, i) => `${i}:00`) 
                          : timeRange === '7d' 
                            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                            : [...Array(30)].map((_, i) => `Day ${i+1}`),
                        datasets: [
                          {
                            label: 'Gas Consumed',
                            data: timeRange === '24h' 
                              ? [...Array(24)].map(() => Math.floor(Math.random() * 100) + 50)
                              : timeRange === '7d'
                                ? [...Array(7)].map(() => Math.floor(Math.random() * 200) + 300)
                                : [...Array(30)].map(() => Math.floor(Math.random() * 400) + 800),
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            borderColor: 'rgba(255, 159, 64, 1)',
                            borderWidth: 2,
                            fill: true,
                          },
                        ],
                      }} 
                      options={getChartOptions('Gas Consumption Over Time')} 
                    />
                  )}
                </Box>
              </GridItem>
              
              <GridItem
                colSpan={{ base: 1, lg: 2 }}
                bg={bgColor}
                borderRadius="md"
                boxShadow="sm"
                p={4}
                borderWidth="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>System Resources</Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
                  <ResourceStat 
                    label="CPU Usage" 
                    value="38%" 
                    change="+5%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={false}
                  />
                  <ResourceStat 
                    label="Memory Usage" 
                    value="62%" 
                    change="+2%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={false}
                  />
                  <ResourceStat 
                    label="Storage Usage" 
                    value="47%" 
                    change="+8%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={false}
                  />
                  <ResourceStat 
                    label="Network I/O" 
                    value="1.2 GB/s" 
                    change="+15%" 
                    period={timeRange === '24h' ? 'past day' : timeRange === '7d' ? 'past week' : 'past month'} 
                    isPositive={false}
                  />
                </SimpleGrid>
              </GridItem>
            </Grid>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Container>
  );
};

// Stat component for Service KPIs
const ServiceStat = ({ label, value, change, period, isPositive }) => {
  return (
    <Stat>
      <StatLabel fontSize="sm" fontWeight="medium">{label}</StatLabel>
      <StatNumber fontSize="2xl">{value}</StatNumber>
      <StatHelpText>
        <span style={{ color: isPositive ? 'green' : 'red' }}>{change}</span> from {period}
      </StatHelpText>
    </Stat>
  );
};

// Stat component for Resource Usage
const ResourceStat = ({ label, value, change, period, isPositive }) => {
  return (
    <Stat>
      <StatLabel fontSize="sm" fontWeight="medium">{label}</StatLabel>
      <StatNumber fontSize="2xl">{value}</StatNumber>
      <StatHelpText>
        <span style={{ color: isPositive ? 'green' : 'red' }}>{change}</span> from {period}
      </StatHelpText>
    </Stat>
  );
};

export default Analytics; 
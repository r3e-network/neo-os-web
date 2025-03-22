import React, { useState, useEffect } from 'react';
import {
  Heading,
  Text,
  Box,
  Button,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useToast,
  Spinner,
  Switch,
  IconButton,
  Stack,
  Tooltip,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  SimpleGrid,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, EditIcon, RepeatIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

// Import the price feed service
import priceFeedService from '../services/priceFeedService';

const PriceFeed = () => {
  const [priceFeeds, setPriceFeeds] = useState([]);
  const [sources, setSources] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    asset: '',
    sources: [],
    interval: 60,
    deviationThreshold: 0.5,
    enabled: true,
    heartbeat: 3600,
  });

  // UI states
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();
  const cancelRef = React.useRef();
  const toast = useToast();

  // Fetch price feeds when component mounts
  useEffect(() => {
    fetchPriceFeeds();
    fetchSources();
    fetchAssets();
  }, []);

  // Fetch price feeds
  const fetchPriceFeeds = async () => {
    setIsLoading(true);
    try {
      const data = await priceFeedService.listPriceFeeds();
      setPriceFeeds(data);
    } catch (error) {
      console.error('Error fetching price feeds:', error);
      toast({
        title: 'Error fetching price feeds',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch sources
  const fetchSources = async () => {
    try {
      const data = await priceFeedService.getSources();
      setSources(data);
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  // Fetch assets
  const fetchAssets = async () => {
    try {
      const data = await priceFeedService.getAssets();
      setAssets(data);
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  // Fetch price feed history
  const fetchPriceFeedHistory = async (id) => {
    try {
      const data = await priceFeedService.getPriceFeedHistory(id);
      setHistory(data);
    } catch (error) {
      console.error('Error fetching price feed history:', error);
      toast({
        title: 'Error fetching price history',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // Handle number input changes
  const handleNumberChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedFeed) {
        // Update existing price feed
        await priceFeedService.updatePriceFeed(selectedFeed.id, formData);
        toast({
          title: 'Price feed updated',
          description: 'The price feed has been successfully updated.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        // Create new price feed
        await priceFeedService.createPriceFeed(formData);
        toast({
          title: 'Price feed created',
          description: 'The price feed has been successfully created.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }

      // Reset form and refresh data
      resetForm();
      fetchPriceFeeds();
      onModalClose();
    } catch (error) {
      console.error('Error saving price feed:', error);
      toast({
        title: 'Error saving price feed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (feed) => {
    setSelectedFeed(feed);
    setFormData({
      name: feed.name,
      asset: feed.asset,
      sources: feed.sources,
      interval: feed.interval,
      deviationThreshold: feed.deviationThreshold,
      enabled: feed.enabled,
      heartbeat: feed.heartbeat,
    });
    onModalOpen();
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedFeed) return;

    setIsSubmitting(true);
    try {
      await priceFeedService.deletePriceFeed(selectedFeed.id);
      toast({
        title: 'Price feed deleted',
        description: 'The price feed has been successfully deleted.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      fetchPriceFeeds();
      setSelectedFeed(null);
      onDeleteClose();
    } catch (error) {
      console.error('Error deleting price feed:', error);
      toast({
        title: 'Error deleting price feed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle manual update
  const handleManualUpdate = async (id) => {
    try {
      await priceFeedService.triggerUpdate(id);
      toast({
        title: 'Update triggered',
        description: 'Manual price update has been triggered.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      fetchPriceFeeds();
    } catch (error) {
      console.error('Error triggering update:', error);
      toast({
        title: 'Error triggering update',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle view details
  const handleViewDetails = (feed) => {
    setSelectedFeed(feed);
    fetchPriceFeedHistory(feed.id);
    onDetailsOpen();
  };

  // Reset form
  const resetForm = () => {
    setSelectedFeed(null);
    setFormData({
      name: '',
      asset: '',
      sources: [],
      interval: 60,
      deviationThreshold: 0.5,
      enabled: true,
      heartbeat: 3600,
    });
  };

  // Add new price feed
  const handleAddNew = () => {
    resetForm();
    onModalOpen();
  };

  // Prepare chart data for price history
  const chartData = {
    labels: history.map(item => new Date(item.timestamp).toLocaleString()),
    datasets: [
      {
        label: selectedFeed ? `${selectedFeed.asset} Price` : 'Price',
        data: history.map(item => item.price),
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.4)',
        borderColor: 'rgba(75,192,192,1)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Price History',
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  // Price feed status badge
  const StatusBadge = ({ enabled, lastUpdated }) => {
    const now = new Date();
    const lastUpdate = new Date(lastUpdated);
    const timeDiff = Math.abs(now - lastUpdate) / 1000; // in seconds
    
    if (!enabled) {
      return <Badge colorScheme="gray">Disabled</Badge>;
    } else if (!lastUpdated) {
      return <Badge colorScheme="yellow">Pending</Badge>;
    } else if (timeDiff > 3600) {
      return <Badge colorScheme="red">Stale</Badge>;
    } else {
      return <Badge colorScheme="green">Active</Badge>;
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">Price Feed</Heading>
        <Button
          leftIcon={<AddIcon />}
          colorScheme="blue"
          onClick={handleAddNew}
        >
          Add New Feed
        </Button>
      </Flex>

      {/* Price Feed Stats */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Feeds</StatLabel>
              <StatNumber>{priceFeeds.length}</StatNumber>
              <StatHelpText>Active monitoring</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Active Feeds</StatLabel>
              <StatNumber>
                {priceFeeds.filter(feed => feed.enabled).length}
              </StatNumber>
              <StatHelpText>Currently updating</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Update Frequency</StatLabel>
              <StatNumber>
                {priceFeeds.length > 0
                  ? Math.round(
                      priceFeeds.reduce((acc, feed) => acc + feed.interval, 0) /
                        priceFeeds.length
                    )
                  : 0}s
              </StatNumber>
              <StatHelpText>Average interval</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Data Sources</StatLabel>
              <StatNumber>{sources.length}</StatNumber>
              <StatHelpText>Available sources</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Price Feed Table */}
      {isLoading ? (
        <Flex justifyContent="center" my={8}>
          <Spinner size="xl" />
        </Flex>
      ) : priceFeeds.length === 0 ? (
        <Box textAlign="center" my={8} p={6} borderWidth={1} borderRadius="md">
          <Text fontSize="lg" mb={4}>No price feeds available</Text>
          <Button colorScheme="blue" onClick={handleAddNew}>
            Create your first price feed
          </Button>
        </Box>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Asset</Th>
                <Th>Latest Price</Th>
                <Th>Sources</Th>
                <Th>Status</Th>
                <Th>Last Update</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {priceFeeds.map((feed) => (
                <Tr key={feed.id}>
                  <Td>{feed.name}</Td>
                  <Td>{feed.asset}</Td>
                  <Td>
                    {feed.latestPrice
                      ? `$${Number(feed.latestPrice).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}`
                      : '-'}
                  </Td>
                  <Td>{feed.sources.length}</Td>
                  <Td>
                    <StatusBadge
                      enabled={feed.enabled}
                      lastUpdated={feed.lastUpdatedAt}
                    />
                  </Td>
                  <Td>{formatTimeAgo(feed.lastUpdatedAt)}</Td>
                  <Td>
                    <Flex>
                      <Tooltip label="View Details">
                        <IconButton
                          icon={<ExternalLinkIcon />}
                          size="sm"
                          mr={2}
                          onClick={() => handleViewDetails(feed)}
                          aria-label="View details"
                        />
                      </Tooltip>
                      <Tooltip label="Edit">
                        <IconButton
                          icon={<EditIcon />}
                          size="sm"
                          mr={2}
                          onClick={() => handleEdit(feed)}
                          aria-label="Edit"
                        />
                      </Tooltip>
                      <Tooltip label="Delete">
                        <IconButton
                          icon={<DeleteIcon />}
                          size="sm"
                          mr={2}
                          colorScheme="red"
                          onClick={() => {
                            setSelectedFeed(feed);
                            onDeleteOpen();
                          }}
                          aria-label="Delete"
                        />
                      </Tooltip>
                      <Tooltip label="Update Now">
                        <IconButton
                          icon={<RepeatIcon />}
                          size="sm"
                          isDisabled={!feed.enabled}
                          onClick={() => handleManualUpdate(feed.id)}
                          aria-label="Update now"
                        />
                      </Tooltip>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={onModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedFeed ? 'Edit Price Feed' : 'Create Price Feed'}
          </ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <Stack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Name</FormLabel>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., NEO/USD Price Feed"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Asset</FormLabel>
                  <Select
                    name="asset"
                    value={formData.asset}
                    onChange={handleChange}
                    placeholder="Select asset"
                  >
                    {assets.map((asset) => (
                      <option key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Data Sources</FormLabel>
                  <Select
                    name="sources"
                    value={formData.sources}
                    onChange={(e) => {
                      const options = e.target.options;
                      const selectedSources = [];
                      for (let i = 0; i < options.length; i++) {
                        if (options[i].selected) {
                          selectedSources.push(options[i].value);
                        }
                      }
                      setFormData({
                        ...formData,
                        sources: selectedSources,
                      });
                    }}
                    placeholder="Select sources"
                    multiple
                    height="100px"
                  >
                    {sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Update Interval (seconds)</FormLabel>
                  <NumberInput
                    min={10}
                    value={formData.interval}
                    onChange={(valueString) =>
                      handleNumberChange('interval', parseInt(valueString, 10))
                    }
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Deviation Threshold (%)</FormLabel>
                  <NumberInput
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={formData.deviationThreshold}
                    onChange={(valueString) =>
                      handleNumberChange(
                        'deviationThreshold',
                        parseFloat(valueString)
                      )
                    }
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Heartbeat (seconds)</FormLabel>
                  <NumberInput
                    min={60}
                    value={formData.heartbeat}
                    onChange={(valueString) =>
                      handleNumberChange('heartbeat', parseInt(valueString, 10))
                    }
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="enabled" mb="0">
                    Enabled
                  </FormLabel>
                  <Switch
                    id="enabled"
                    name="enabled"
                    isChecked={formData.enabled}
                    onChange={handleChange}
                  />
                </FormControl>
              </Stack>
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onModalClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                type="submit"
                isLoading={isSubmitting}
              >
                {selectedFeed ? 'Update' : 'Create'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Price Feed
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this price feed? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                ml={3}
                isLoading={isSubmitting}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedFeed ? selectedFeed.name : 'Price Feed Details'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedFeed && (
              <Tabs isFitted variant="enclosed">
                <TabList>
                  <Tab>Overview</Tab>
                  <Tab>History</Tab>
                  <Tab>Configuration</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel>
                    <SimpleGrid columns={2} spacing={4}>
                      <Box>
                        <Text fontWeight="bold">Asset:</Text>
                        <Text>{selectedFeed.asset}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Latest Price:</Text>
                        <Text>
                          {selectedFeed.latestPrice
                            ? `$${Number(selectedFeed.latestPrice).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}`
                            : '-'}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Status:</Text>
                        <StatusBadge
                          enabled={selectedFeed.enabled}
                          lastUpdated={selectedFeed.lastUpdatedAt}
                        />
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Last Update:</Text>
                        <Text>{formatTimeAgo(selectedFeed.lastUpdatedAt)}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">On-Chain Address:</Text>
                        <Text>{selectedFeed.contractAddress || 'Not deployed'}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Created At:</Text>
                        <Text>
                          {new Date(selectedFeed.createdAt).toLocaleString()}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </TabPanel>

                  <TabPanel>
                    <Box h="300px">
                      {history.length === 0 ? (
                        <Flex justifyContent="center" alignItems="center" h="100%">
                          <Text>No historical data available</Text>
                        </Flex>
                      ) : (
                        <Line data={chartData} options={chartOptions} />
                      )}
                    </Box>
                  </TabPanel>

                  <TabPanel>
                    <SimpleGrid columns={2} spacing={4}>
                      <Box>
                        <Text fontWeight="bold">Update Interval:</Text>
                        <Text>{selectedFeed.interval} seconds</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Deviation Threshold:</Text>
                        <Text>{selectedFeed.deviationThreshold}%</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Heartbeat:</Text>
                        <Text>{selectedFeed.heartbeat} seconds</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Sources:</Text>
                        <Text>{selectedFeed.sources.join(', ')}</Text>
                      </Box>
                    </SimpleGrid>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            )}
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onDetailsClose}>
              Close
            </Button>
            <Button
              onClick={() => handleManualUpdate(selectedFeed.id)}
              isDisabled={!selectedFeed?.enabled}
            >
              Update Now
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default PriceFeed; 
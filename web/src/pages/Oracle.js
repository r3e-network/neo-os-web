import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Heading, Text, Flex, Button, Tabs, TabList, TabPanels, Tab, TabPanel,
  Table, Thead, Tbody, Tr, Th, Td, Badge, useDisclosure, Spinner,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  FormControl, FormLabel, Input, Textarea, Select, Switch, FormHelperText,
  useToast, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, IconButton,
  Menu, MenuButton, MenuList, MenuItem, Tooltip, Code, Alert, AlertIcon, Link
} from '@chakra-ui/react';
import { FiPlus, FiRefreshCw, FiMoreVertical, FiEdit, FiTrash2, FiPlay, FiInfo } from 'react-icons/fi';
import oracleService from '../services/oracleService';
import JsonEditor from '../components/JsonEditor';
import CodeBlock from '../components/CodeBlock';

const Oracle = () => {
  // State variables
  const [dataSources, setDataSources] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    totalDataSources: 0,
    totalRequests: 0,
    successRate: 0,
    averageResponseTime: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDataSource, setSelectedDataSource] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [examples, setExamples] = useState(null);
  
  // Form state
  const [newDataSource, setNewDataSource] = useState({
    name: '',
    description: '',
    sourceType: 'HTTP',
    url: '',
    method: 'GET',
    headers: {},
    body: '',
    authType: 'NONE',
    authParams: {},
    path: '',
    transform: '',
    schedule: ''
  });
  
  // Modal controls
  const { 
    isOpen: isDataSourceModalOpen, 
    onOpen: onDataSourceModalOpen, 
    onClose: onDataSourceModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isRequestModalOpen, 
    onOpen: onRequestModalOpen, 
    onClose: onRequestModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isTestModalOpen, 
    onOpen: onTestModalOpen, 
    onClose: onTestModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isExamplesModalOpen, 
    onOpen: onExamplesModalOpen, 
    onClose: onExamplesModalClose 
  } = useDisclosure();
  
  const toast = useToast();
  const initialRef = useRef();

  // Load data
  useEffect(() => {
    fetchDataSources();
    fetchRequests();
    fetchStats();
    fetchExamples();
  }, []);

  const fetchDataSources = async () => {
    setIsLoading(true);
    try {
      const response = await oracleService.listDataSources();
      setDataSources(response.data || []);
    } catch (error) {
      toast({
        title: 'Error fetching data sources',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await oracleService.listRequests();
      setRequests(response.data || []);
    } catch (error) {
      toast({
        title: 'Error fetching requests',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const fetchStats = async () => {
    try {
      const response = await oracleService.getOracleStats();
      setStats(response.data || {
        totalDataSources: 0,
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchExamples = async () => {
    try {
      const response = await oracleService.getContractIntegrationExamples();
      setExamples(response.data || null);
    } catch (error) {
      console.error('Error fetching examples:', error);
    }
  };

  const handleCreateDataSource = async () => {
    try {
      await oracleService.createDataSource(newDataSource);
      toast({
        title: 'Data source created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchDataSources();
      onDataSourceModalClose();
      resetForm();
    } catch (error) {
      toast({
        title: 'Failed to create data source',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleUpdateDataSource = async () => {
    try {
      await oracleService.updateDataSource(selectedDataSource.id, newDataSource);
      toast({
        title: 'Data source updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchDataSources();
      onDataSourceModalClose();
      resetForm();
    } catch (error) {
      toast({
        title: 'Failed to update data source',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDeleteDataSource = async (id) => {
    if (window.confirm('Are you sure you want to delete this data source?')) {
      try {
        await oracleService.deleteDataSource(id);
        toast({
          title: 'Data source deleted',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        fetchDataSources();
      } catch (error) {
        toast({
          title: 'Failed to delete data source',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

  const handleTestDataSource = async (id) => {
    try {
      setIsLoading(true);
      const response = await oracleService.testDataSource(id);
      setSelectedRequest(response.data);
      onTestModalOpen();
    } catch (error) {
      toast({
        title: 'Test failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDataSourceModal = (dataSource) => {
    setSelectedDataSource(dataSource);
    setNewDataSource({
      name: dataSource.name,
      description: dataSource.description,
      sourceType: dataSource.source_type,
      url: dataSource.url,
      method: dataSource.method,
      headers: dataSource.headers || {},
      body: dataSource.body || '',
      authType: dataSource.auth_type,
      authParams: dataSource.auth_params || {},
      path: dataSource.path || '',
      transform: dataSource.transform || '',
      schedule: dataSource.schedule || ''
    });
    onDataSourceModalOpen();
  };

  const openCreateDataSourceModal = () => {
    setSelectedDataSource(null);
    resetForm();
    onDataSourceModalOpen();
  };

  const viewRequestDetails = async (id) => {
    try {
      const response = await oracleService.getRequest(id);
      setSelectedRequest(response.data);
      onRequestModalOpen();
    } catch (error) {
      toast({
        title: 'Error fetching request details',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const resetForm = () => {
    setNewDataSource({
      name: '',
      description: '',
      sourceType: 'HTTP',
      url: '',
      method: 'GET',
      headers: {},
      body: '',
      authType: 'NONE',
      authParams: {},
      path: '',
      transform: '',
      schedule: ''
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge colorScheme="green">Success</Badge>;
      case 'FAILED':
        return <Badge colorScheme="red">Failed</Badge>;
      case 'PENDING':
        return <Badge colorScheme="yellow">Pending</Badge>;
      case 'PROCESSING':
        return <Badge colorScheme="blue">Processing</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="lg">Oracle Service</Heading>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={openCreateDataSourceModal}>
          New Data Source
        </Button>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={5} mb={6}>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Total Data Sources</StatLabel>
          <StatNumber>{stats.totalDataSources}</StatNumber>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Total Requests</StatLabel>
          <StatNumber>{stats.totalRequests}</StatNumber>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Success Rate</StatLabel>
          <StatNumber>{stats.successRate}%</StatNumber>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Avg Response Time</StatLabel>
          <StatNumber>{stats.averageResponseTime} ms</StatNumber>
        </Stat>
      </SimpleGrid>

      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>Data Sources</Tab>
          <Tab>Request History</Tab>
          <Tab>Integration</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Flex justifyContent="flex-end" mb={4}>
              <Button 
                leftIcon={<FiRefreshCw />} 
                variant="outline" 
                onClick={fetchDataSources}
                isLoading={isLoading}
              >
                Refresh
              </Button>
            </Flex>

            {isLoading ? (
              <Flex justifyContent="center" alignItems="center" h="200px">
                <Spinner />
              </Flex>
            ) : dataSources.length === 0 ? (
              <Box textAlign="center" p={6} bg="white" borderRadius="md">
                <Text mb={4}>No data sources found. Create your first data source to get started.</Text>
                <Button onClick={openCreateDataSourceModal} colorScheme="blue">
                  Create Data Source
                </Button>
              </Box>
            ) : (
              <Table variant="simple" bg="white">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>URL</Th>
                    <Th>Schedule</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {dataSources.map((source) => (
                    <Tr key={source.id}>
                      <Td>
                        <Text fontWeight="bold">{source.name}</Text>
                        <Text fontSize="sm" color="gray.600">{source.description}</Text>
                      </Td>
                      <Td>{source.source_type}</Td>
                      <Td>
                        <Text noOfLines={1}>{source.url}</Text>
                      </Td>
                      <Td>{source.schedule || "Manual"}</Td>
                      <Td>
                        <Menu>
                          <MenuButton 
                            as={IconButton} 
                            icon={<FiMoreVertical />} 
                            variant="ghost" 
                            size="sm" 
                          />
                          <MenuList>
                            <MenuItem icon={<FiEdit />} onClick={() => openEditDataSourceModal(source)}>
                              Edit
                            </MenuItem>
                            <MenuItem icon={<FiTrash2 />} onClick={() => handleDeleteDataSource(source.id)}>
                              Delete
                            </MenuItem>
                            <MenuItem icon={<FiPlay />} onClick={() => handleTestDataSource(source.id)}>
                              Test
                            </MenuItem>
                          </MenuList>
                        </Menu>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </TabPanel>

          <TabPanel>
            <Flex justifyContent="flex-end" mb={4}>
              <Button 
                leftIcon={<FiRefreshCw />} 
                variant="outline" 
                onClick={fetchRequests}
              >
                Refresh
              </Button>
            </Flex>

            {requests.length === 0 ? (
              <Box textAlign="center" p={6} bg="white" borderRadius="md">
                <Text>No requests found.</Text>
              </Box>
            ) : (
              <Table variant="simple" bg="white">
                <Thead>
                  <Tr>
                    <Th>ID</Th>
                    <Th>Data Source</Th>
                    <Th>Status</Th>
                    <Th>Created At</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {requests.map((request) => (
                    <Tr key={request.id}>
                      <Td>{request.id}</Td>
                      <Td>{request.data_source_name}</Td>
                      <Td>{getStatusBadge(request.status)}</Td>
                      <Td>{formatDate(request.created_at)}</Td>
                      <Td>
                        <Tooltip label="View Details">
                          <IconButton 
                            icon={<FiInfo />} 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => viewRequestDetails(request.id)} 
                          />
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </TabPanel>

          <TabPanel>
            <Box bg="white" p={6} borderRadius="md">
              <Text fontWeight="bold" mb={4}>Integrate Oracle Service with Your Smart Contracts</Text>
              
              <Alert status="info" mb={6}>
                <AlertIcon />
                <Text>
                  The Oracle service allows your smart contracts to access off-chain data. 
                  Below are examples of how to integrate with our service.
                </Text>
              </Alert>

              <Box mb={6}>
                <Heading size="md" mb={2}>Getting Started</Heading>
                <Text mb={4}>
                  To integrate your smart contract with our Oracle service, you need to:
                </Text>
                <Box as="ol" styleType="decimal" ml={5}>
                  <Box as="li" mb={2}>Create a data source in the dashboard</Box>
                  <Box as="li" mb={2}>Deploy a contract that implements the Oracle consumer interface</Box>
                  <Box as="li" mb={2}>Call the Oracle service from your contract</Box>
                  <Box as="li" mb={2}>Handle the callback with the requested data</Box>
                </Box>
              </Box>

              <Button colorScheme="blue" onClick={onExamplesModalOpen}>
                View Contract Examples
              </Button>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Data Source Modal */}
      <Modal
        isOpen={isDataSourceModalOpen}
        onClose={onDataSourceModalClose}
        size="xl"
        initialFocusRef={initialRef}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedDataSource ? 'Edit Data Source' : 'Create Data Source'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4} isRequired>
              <FormLabel>Name</FormLabel>
              <Input
                ref={initialRef}
                value={newDataSource.name}
                onChange={(e) => setNewDataSource({ ...newDataSource, name: e.target.value })}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={newDataSource.description}
                onChange={(e) => setNewDataSource({ ...newDataSource, description: e.target.value })}
              />
            </FormControl>

            <FormControl mb={4} isRequired>
              <FormLabel>Source Type</FormLabel>
              <Select
                value={newDataSource.sourceType}
                onChange={(e) => setNewDataSource({ ...newDataSource, sourceType: e.target.value })}
              >
                <option value="HTTP">HTTP</option>
                <option value="WS">WebSocket</option>
                <option value="DB">Database</option>
                <option value="BLOCKCHAIN">Blockchain</option>
              </Select>
            </FormControl>

            <FormControl mb={4} isRequired>
              <FormLabel>URL</FormLabel>
              <Input
                value={newDataSource.url}
                onChange={(e) => setNewDataSource({ ...newDataSource, url: e.target.value })}
              />
            </FormControl>

            <FormControl mb={4} isRequired>
              <FormLabel>Method</FormLabel>
              <Select
                value={newDataSource.method}
                onChange={(e) => setNewDataSource({ ...newDataSource, method: e.target.value })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </Select>
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Headers (JSON)</FormLabel>
              <JsonEditor
                value={newDataSource.headers}
                onChange={(json) => setNewDataSource({ ...newDataSource, headers: json })}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Body</FormLabel>
              <Textarea
                value={newDataSource.body}
                onChange={(e) => setNewDataSource({ ...newDataSource, body: e.target.value })}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Authentication Type</FormLabel>
              <Select
                value={newDataSource.authType}
                onChange={(e) => setNewDataSource({ ...newDataSource, authType: e.target.value })}
              >
                <option value="NONE">None</option>
                <option value="BASIC">Basic</option>
                <option value="BEARER">Bearer Token</option>
                <option value="API_KEY">API Key</option>
                <option value="OAUTH2">OAuth 2.0</option>
              </Select>
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Authentication Parameters (JSON)</FormLabel>
              <JsonEditor
                value={newDataSource.authParams}
                onChange={(json) => setNewDataSource({ ...newDataSource, authParams: json })}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>JSON Path</FormLabel>
              <Input
                value={newDataSource.path}
                onChange={(e) => setNewDataSource({ ...newDataSource, path: e.target.value })}
              />
              <FormHelperText>
                The JSON path to extract data (e.g., $.data.price)
              </FormHelperText>
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Transform Function (JavaScript)</FormLabel>
              <Textarea
                value={newDataSource.transform}
                onChange={(e) => setNewDataSource({ ...newDataSource, transform: e.target.value })}
                placeholder="function transform(data) { return data; }"
                h="100px"
              />
              <FormHelperText>
                Optional JavaScript function to transform the data before sending to the blockchain
              </FormHelperText>
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Schedule (Cron Expression)</FormLabel>
              <Input
                value={newDataSource.schedule}
                onChange={(e) => setNewDataSource({ ...newDataSource, schedule: e.target.value })}
                placeholder="*/15 * * * *"
              />
              <FormHelperText>
                Optional cron expression for automatic updates (e.g., "*/15 * * * *" for every 15 minutes)
              </FormHelperText>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDataSourceModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={selectedDataSource ? handleUpdateDataSource : handleCreateDataSource}
            >
              {selectedDataSource ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Request Details Modal */}
      <Modal isOpen={isRequestModalOpen} onClose={onRequestModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Request Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedRequest && (
              <Box>
                <SimpleGrid columns={2} spacing={4} mb={4}>
                  <Box>
                    <Text fontWeight="bold">Request ID:</Text>
                    <Text>{selectedRequest.id}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Status:</Text>
                    <Text>{getStatusBadge(selectedRequest.status)}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Created At:</Text>
                    <Text>{formatDate(selectedRequest.created_at)}</Text>
                  </Box>
                  <Box>
                    <Text fontWeight="bold">Updated At:</Text>
                    <Text>{formatDate(selectedRequest.updated_at)}</Text>
                  </Box>
                </SimpleGrid>

                <Box mb={4}>
                  <Text fontWeight="bold" mb={1}>Data Source:</Text>
                  <Text>{selectedRequest.data_source_name}</Text>
                </Box>

                {selectedRequest.request_data && (
                  <Box mb={4}>
                    <Text fontWeight="bold" mb={1}>Request Data:</Text>
                    <Code p={2} borderRadius="md" w="100%">
                      {JSON.stringify(selectedRequest.request_data, null, 2)}
                    </Code>
                  </Box>
                )}

                {selectedRequest.response_data && (
                  <Box mb={4}>
                    <Text fontWeight="bold" mb={1}>Response Data:</Text>
                    <Code p={2} borderRadius="md" w="100%">
                      {JSON.stringify(selectedRequest.response_data, null, 2)}
                    </Code>
                  </Box>
                )}

                {selectedRequest.error && (
                  <Alert status="error" mb={4}>
                    <AlertIcon />
                    <Box>
                      <Text fontWeight="bold">Error:</Text>
                      <Text>{selectedRequest.error}</Text>
                    </Box>
                  </Alert>
                )}

                {selectedRequest.transaction_hash && (
                  <Box mb={4}>
                    <Text fontWeight="bold" mb={1}>Transaction Hash:</Text>
                    <Link href={`https://neo3.testnet.neotube.io/transaction/${selectedRequest.transaction_hash}`} isExternal color="blue.500">
                      {selectedRequest.transaction_hash}
                    </Link>
                  </Box>
                )}
              </Box>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onRequestModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Test Result Modal */}
      <Modal isOpen={isTestModalOpen} onClose={onTestModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Test Result</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedRequest && (
              <Box>
                <Alert 
                  status={selectedRequest.status === 'SUCCESS' ? 'success' : 'error'} 
                  mb={4}
                >
                  <AlertIcon />
                  <Text>
                    Test {selectedRequest.status === 'SUCCESS' ? 'successful!' : 'failed.'}
                  </Text>
                </Alert>

                {selectedRequest.response_data && (
                  <Box mb={4}>
                    <Text fontWeight="bold" mb={1}>Response Data:</Text>
                    <Code p={2} borderRadius="md" w="100%">
                      {JSON.stringify(selectedRequest.response_data, null, 2)}
                    </Code>
                  </Box>
                )}

                {selectedRequest.error && (
                  <Box mb={4}>
                    <Text fontWeight="bold" mb={1}>Error:</Text>
                    <Text color="red.500">{selectedRequest.error}</Text>
                  </Box>
                )}

                {selectedRequest.execution_time && (
                  <Box mb={4}>
                    <Text fontWeight="bold" mb={1}>Execution Time:</Text>
                    <Text>{selectedRequest.execution_time} ms</Text>
                  </Box>
                )}
              </Box>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onTestModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Contract Examples Modal */}
      <Modal isOpen={isExamplesModalOpen} onClose={onExamplesModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Contract Integration Examples</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {examples ? (
              <Box>
                <Tabs variant="soft-rounded" colorScheme="blue">
                  <TabList mb={4}>
                    <Tab>Basic Consumer</Tab>
                    <Tab>Price Feed Consumer</Tab>
                    <Tab>Custom Data Consumer</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <CodeBlock
                        code={examples.basic_consumer || 
                          `// Loading example code...`}
                        language="csharp"
                      />
                    </TabPanel>
                    <TabPanel>
                      <CodeBlock
                        code={examples.price_feed_consumer ||
                          `// Loading example code...`}
                        language="csharp"
                      />
                    </TabPanel>
                    <TabPanel>
                      <CodeBlock
                        code={examples.custom_data_consumer ||
                          `// Loading example code...`}
                        language="csharp"
                      />
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </Box>
            ) : (
              <Flex justifyContent="center" py={10}>
                <Spinner />
              </Flex>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onExamplesModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Oracle; 
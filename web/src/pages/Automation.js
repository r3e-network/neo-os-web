import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Heading, Text, Flex, Button, Tabs, TabList, TabPanels, Tab, TabPanel,
  Table, Thead, Tbody, Tr, Th, Td, Badge, useDisclosure, Spinner,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  FormControl, FormLabel, Input, Select, Textarea, Switch, FormHelperText,
  useToast, SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, IconButton,
  Menu, MenuButton, MenuList, MenuItem, Tooltip, Code, Alert, AlertIcon, Link,
  Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
  Divider, Radio, RadioGroup, Stack, Checkbox
} from '@chakra-ui/react';
import { 
  FiPlus, FiRefreshCw, FiPlay, FiInfo, FiEdit, FiTrash2, FiSettings, 
  FiClock, FiCalendar, FiDollarSign, FiActivity, FiCode, FiMoreVertical 
} from 'react-icons/fi';
import automationService from '../services/automationService';
import CodeBlock from '../components/CodeBlock';

const Automation = () => {
  // State variables
  const [triggers, setTriggers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [triggerTypes, setTriggerTypes] = useState([]);
  const [conditionTypes, setConditionTypes] = useState([]);
  const [integrationExamples, setIntegrationExamples] = useState(null);
  const [stats, setStats] = useState({
    totalTriggers: 0,
    activeTriggers: 0,
    executionsToday: 0,
    executionsTotal: 0,
    successRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrigger, setSelectedTrigger] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);

  // Form state
  const [newTrigger, setNewTrigger] = useState({
    name: '',
    description: '',
    type: 'CRON',
    enabled: true,
    parameters: {},
    conditions: [],
    actions: {
      contract_hash: '',
      method: '',
      parameters: []
    }
  });
  
  // Form parameters for different trigger types
  const [cronExpression, setCronExpression] = useState('*/30 * * * *');
  const [priceAsset, setPriceAsset] = useState('NEO');
  const [priceThreshold, setPriceThreshold] = useState(0);
  const [priceDirection, setPriceDirection] = useState('ABOVE');
  const [eventContract, setEventContract] = useState('');
  const [eventName, setEventName] = useState('');
  
  // Modal controls
  const { 
    isOpen: isTriggerModalOpen, 
    onOpen: onTriggerModalOpen, 
    onClose: onTriggerModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isHistoryModalOpen, 
    onOpen: onHistoryModalOpen, 
    onClose: onHistoryModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isContractModalOpen, 
    onOpen: onContractModalOpen, 
    onClose: onContractModalClose 
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
    fetchTriggers();
    fetchContracts();
    fetchTriggerTypes();
    fetchConditionTypes();
    fetchStats();
    fetchExamples();
  }, []);

  const fetchTriggers = async () => {
    setIsLoading(true);
    try {
      const response = await automationService.listTriggers();
      setTriggers(response.data || []);
    } catch (error) {
      toast({
        title: 'Error fetching triggers',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContracts = async () => {
    try {
      const response = await automationService.getRegisteredContracts();
      setContracts(response.data || []);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    }
  };

  const fetchTriggerTypes = async () => {
    try {
      const response = await automationService.getTriggerTypes();
      setTriggerTypes(response.data || []);
    } catch (error) {
      console.error('Error fetching trigger types:', error);
    }
  };

  const fetchConditionTypes = async () => {
    try {
      const response = await automationService.getConditionTypes();
      setConditionTypes(response.data || []);
    } catch (error) {
      console.error('Error fetching condition types:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await automationService.getAutomationStats();
      setStats(response.data || {
        totalTriggers: 0,
        activeTriggers: 0,
        executionsToday: 0,
        executionsTotal: 0,
        successRate: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchExamples = async () => {
    try {
      const response = await automationService.getContractIntegrationExamples();
      setIntegrationExamples(response.data || null);
    } catch (error) {
      console.error('Error fetching examples:', error);
    }
  };

  const fetchTriggerHistory = async (id) => {
    try {
      const response = await automationService.getTriggerHistory(id);
      setExecutionHistory(response.data || []);
    } catch (error) {
      toast({
        title: 'Error fetching execution history',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const handleCreateTrigger = async () => {
    // Prepare the trigger data based on the selected type
    const triggerData = { ...newTrigger };
    
    // Set parameters based on the trigger type
    switch (newTrigger.type) {
      case 'CRON':
        triggerData.parameters = {
          expression: cronExpression
        };
        break;
      case 'PRICE':
        triggerData.parameters = {
          asset: priceAsset,
          threshold: parseFloat(priceThreshold),
          direction: priceDirection
        };
        break;
      case 'EVENT':
        triggerData.parameters = {
          contract_hash: eventContract,
          event_name: eventName
        };
        break;
      default:
        break;
    }
    
    try {
      await automationService.createTrigger(triggerData);
      toast({
        title: 'Trigger created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchTriggers();
      onTriggerModalClose();
      resetForm();
    } catch (error) {
      toast({
        title: 'Failed to create trigger',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleUpdateTrigger = async () => {
    if (!selectedTrigger) return;
    
    // Prepare the trigger data based on the selected type
    const triggerData = { ...newTrigger };
    
    // Set parameters based on the trigger type
    switch (newTrigger.type) {
      case 'CRON':
        triggerData.parameters = {
          expression: cronExpression
        };
        break;
      case 'PRICE':
        triggerData.parameters = {
          asset: priceAsset,
          threshold: parseFloat(priceThreshold),
          direction: priceDirection
        };
        break;
      case 'EVENT':
        triggerData.parameters = {
          contract_hash: eventContract,
          event_name: eventName
        };
        break;
      default:
        break;
    }
    
    try {
      await automationService.updateTrigger(selectedTrigger.id, triggerData);
      toast({
        title: 'Trigger updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchTriggers();
      onTriggerModalClose();
      resetForm();
    } catch (error) {
      toast({
        title: 'Failed to update trigger',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDeleteTrigger = async (id) => {
    if (window.confirm('Are you sure you want to delete this trigger?')) {
      try {
        await automationService.deleteTrigger(id);
        toast({
          title: 'Trigger deleted',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        fetchTriggers();
      } catch (error) {
        toast({
          title: 'Failed to delete trigger',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

  const handleExecuteTrigger = async (id) => {
    try {
      setIsLoading(true);
      await automationService.executeTrigger(id);
      toast({
        title: 'Trigger executed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchTriggers();
      if (selectedTrigger && selectedTrigger.id === id) {
        fetchTriggerHistory(id);
      }
    } catch (error) {
      toast({
        title: 'Failed to execute trigger',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterContract = async (contractData) => {
    try {
      await automationService.registerContract(contractData);
      toast({
        title: 'Contract registered',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchContracts();
      onContractModalClose();
    } catch (error) {
      toast({
        title: 'Failed to register contract',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const openCreateTriggerModal = () => {
    setSelectedTrigger(null);
    resetForm();
    onTriggerModalOpen();
  };

  const openEditTriggerModal = (trigger) => {
    setSelectedTrigger(trigger);
    
    // Set form values based on the trigger data
    setNewTrigger({
      name: trigger.name,
      description: trigger.description,
      type: trigger.type,
      enabled: trigger.enabled,
      parameters: trigger.parameters || {},
      conditions: trigger.conditions || [],
      actions: trigger.actions || {
        contract_hash: '',
        method: '',
        parameters: []
      }
    });
    
    // Set specific parameters based on the trigger type
    switch (trigger.type) {
      case 'CRON':
        setCronExpression(trigger.parameters?.expression || '*/30 * * * *');
        break;
      case 'PRICE':
        setPriceAsset(trigger.parameters?.asset || 'NEO');
        setPriceThreshold(trigger.parameters?.threshold || 0);
        setPriceDirection(trigger.parameters?.direction || 'ABOVE');
        break;
      case 'EVENT':
        setEventContract(trigger.parameters?.contract_hash || '');
        setEventName(trigger.parameters?.event_name || '');
        break;
      default:
        break;
    }
    
    onTriggerModalOpen();
  };

  const openTriggerHistoryModal = (trigger) => {
    setSelectedTrigger(trigger);
    fetchTriggerHistory(trigger.id);
    onHistoryModalOpen();
  };

  const resetForm = () => {
    setNewTrigger({
      name: '',
      description: '',
      type: 'CRON',
      enabled: true,
      parameters: {},
      conditions: [],
      actions: {
        contract_hash: '',
        method: '',
        parameters: []
      }
    });
    setCronExpression('*/30 * * * *');
    setPriceAsset('NEO');
    setPriceThreshold(0);
    setPriceDirection('ABOVE');
    setEventContract('');
    setEventName('');
  };
  
  // UI Helper Functions
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTriggerTypeIcon = (type) => {
    switch (type) {
      case 'CRON':
        return <FiClock />;
      case 'PRICE':
        return <FiDollarSign />;
      case 'EVENT':
        return <FiActivity />;
      default:
        return <FiCode />;
    }
  };

  const getTriggerTypeColor = (type) => {
    switch (type) {
      case 'CRON':
        return 'blue';
      case 'PRICE':
        return 'green';
      case 'EVENT':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const getTriggerTypeBadge = (type) => {
    return (
      <Badge colorScheme={getTriggerTypeColor(type)}>
        {type}
      </Badge>
    );
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

  const getFormattedParameters = (type, parameters) => {
    if (!parameters) return 'No parameters';
    
    switch (type) {
      case 'CRON':
        return parameters.expression || 'No schedule set';
      case 'PRICE':
        return `${parameters.asset || 'Unknown'} ${parameters.direction || '='} ${parameters.threshold || 0}`;
      case 'EVENT':
        return `${parameters.event_name || 'Unknown event'} on ${parameters.contract_hash ? parameters.contract_hash.substring(0, 8) + '...' : 'Unknown contract'}`;
      default:
        return JSON.stringify(parameters);
    }
  };

  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="lg">Contract Automation</Heading>
        <Flex>
          <Button 
            leftIcon={<FiPlus />} 
            colorScheme="blue" 
            mr={2}
            onClick={openCreateTriggerModal}
          >
            New Trigger
          </Button>
          <Button 
            leftIcon={<FiSettings />} 
            variant="outline" 
            onClick={onContractModalOpen}
          >
            Register Contract
          </Button>
        </Flex>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={5} mb={6}>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Total Triggers</StatLabel>
          <StatNumber>{stats.totalTriggers}</StatNumber>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Active Triggers</StatLabel>
          <StatNumber>{stats.activeTriggers}</StatNumber>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Executions Today</StatLabel>
          <StatNumber>{stats.executionsToday}</StatNumber>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Total Executions</StatLabel>
          <StatNumber>{stats.executionsTotal}</StatNumber>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Success Rate</StatLabel>
          <StatNumber>{stats.successRate}%</StatNumber>
        </Stat>
      </SimpleGrid>

      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>Triggers</Tab>
          <Tab>Integration</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Flex justifyContent="flex-end" mb={4}>
              <Button 
                leftIcon={<FiRefreshCw />} 
                variant="outline" 
                onClick={fetchTriggers}
                isLoading={isLoading}
              >
                Refresh
              </Button>
            </Flex>

            {isLoading ? (
              <Flex justifyContent="center" alignItems="center" h="200px">
                <Spinner />
              </Flex>
            ) : triggers.length === 0 ? (
              <Box textAlign="center" p={6} bg="white" borderRadius="md">
                <Text mb={4}>No triggers found. Create your first automation trigger to get started.</Text>
                <Button onClick={openCreateTriggerModal} colorScheme="blue">
                  Create Trigger
                </Button>
              </Box>
            ) : (
              <Table variant="simple" bg="white">
                <Thead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Parameters</Th>
                    <Th>Status</Th>
                    <Th>Last Execution</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {triggers.map((trigger) => (
                    <Tr key={trigger.id}>
                      <Td>
                        <Flex align="center">
                          {getTriggerTypeIcon(trigger.type)}
                          <Box ml={2}>
                            <Text fontWeight="bold">{trigger.name}</Text>
                            <Text fontSize="sm" color="gray.600" noOfLines={1}>
                              {trigger.description}
                            </Text>
                          </Box>
                        </Flex>
                      </Td>
                      <Td>{getTriggerTypeBadge(trigger.type)}</Td>
                      <Td>
                        <Text fontSize="sm">
                          {getFormattedParameters(trigger.type, trigger.parameters)}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={trigger.enabled ? "green" : "gray"}>
                          {trigger.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </Td>
                      <Td>
                        {trigger.last_execution ? (
                          <Flex direction="column">
                            <Text fontSize="sm">{formatDate(trigger.last_execution.timestamp)}</Text>
                            {getStatusBadge(trigger.last_execution.status)}
                          </Flex>
                        ) : (
                          <Text fontSize="sm">Never</Text>
                        )}
                      </Td>
                      <Td>
                        <Menu>
                          <MenuButton 
                            as={IconButton} 
                            icon={<FiMoreVertical />} 
                            variant="ghost" 
                            size="sm" 
                          />
                          <MenuList>
                            <MenuItem icon={<FiEdit />} onClick={() => openEditTriggerModal(trigger)}>
                              Edit
                            </MenuItem>
                            <MenuItem icon={<FiTrash2 />} onClick={() => handleDeleteTrigger(trigger.id)}>
                              Delete
                            </MenuItem>
                            <MenuItem icon={<FiPlay />} onClick={() => handleExecuteTrigger(trigger.id)}>
                              Execute Now
                            </MenuItem>
                            <MenuItem icon={<FiInfo />} onClick={() => openTriggerHistoryModal(trigger)}>
                              View History
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
            <Box bg="white" p={6} borderRadius="md">
              <Text fontWeight="bold" mb={4}>Integrate Contract Automation with Your Smart Contracts</Text>
              
              <Alert status="info" mb={6}>
                <AlertIcon />
                <Text>
                  Contract Automation allows your smart contracts to execute methods based on time schedules, 
                  price movements, or blockchain events.
                </Text>
              </Alert>

              <Box mb={6}>
                <Heading size="md" mb={2}>Getting Started</Heading>
                <Text mb={4}>
                  To use contract automation with your Neo N3 smart contract:
                </Text>
                <Box as="ol" styleType="decimal" ml={5}>
                  <Box as="li" mb={2}>Register your contract using the "Register Contract" button</Box>
                  <Box as="li" mb={2}>Implement the automation interface in your contract</Box>
                  <Box as="li" mb={2}>Create automation triggers that call your contract methods</Box>
                  <Box as="li" mb={2}>Monitor executions and set up alerts as needed</Box>
                </Box>
              </Box>

              <Button colorScheme="blue" onClick={onExamplesModalOpen}>
                View Contract Examples
              </Button>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Trigger Modal */}
      <Modal
        isOpen={isTriggerModalOpen}
        onClose={onTriggerModalClose}
        size="xl"
        initialFocusRef={initialRef}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedTrigger ? 'Edit Trigger' : 'Create Trigger'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={4} isRequired>
              <FormLabel>Name</FormLabel>
              <Input
                ref={initialRef}
                value={newTrigger.name}
                onChange={(e) => setNewTrigger({ ...newTrigger, name: e.target.value })}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={newTrigger.description}
                onChange={(e) => setNewTrigger({ ...newTrigger, description: e.target.value })}
              />
            </FormControl>

            <FormControl mb={4} isRequired>
              <FormLabel>Trigger Type</FormLabel>
              <Select
                value={newTrigger.type}
                onChange={(e) => setNewTrigger({ ...newTrigger, type: e.target.value })}
              >
                <option value="CRON">Time-based (CRON)</option>
                <option value="PRICE">Price Movement</option>
                <option value="EVENT">Blockchain Event</option>
              </Select>
            </FormControl>

            {/* Dynamic form fields based on trigger type */}
            {newTrigger.type === 'CRON' && (
              <FormControl mb={4} isRequired>
                <FormLabel>CRON Expression</FormLabel>
                <Input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="*/30 * * * *"
                />
                <FormHelperText>
                  Format: minute hour day-of-month month day-of-week (e.g., "*/30 * * * *" for every 30 minutes)
                </FormHelperText>
              </FormControl>
            )}

            {newTrigger.type === 'PRICE' && (
              <>
                <FormControl mb={4} isRequired>
                  <FormLabel>Asset</FormLabel>
                  <Select
                    value={priceAsset}
                    onChange={(e) => setPriceAsset(e.target.value)}
                  >
                    <option value="NEO">NEO</option>
                    <option value="GAS">GAS</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="USDT">USDT</option>
                  </Select>
                </FormControl>

                <FormControl mb={4} isRequired>
                  <FormLabel>Direction</FormLabel>
                  <Select
                    value={priceDirection}
                    onChange={(e) => setPriceDirection(e.target.value)}
                  >
                    <option value="ABOVE">Above Threshold</option>
                    <option value="BELOW">Below Threshold</option>
                  </Select>
                </FormControl>

                <FormControl mb={4} isRequired>
                  <FormLabel>Price Threshold</FormLabel>
                  <Input
                    type="number"
                    value={priceThreshold}
                    onChange={(e) => setPriceThreshold(e.target.value)}
                  />
                </FormControl>
              </>
            )}

            {newTrigger.type === 'EVENT' && (
              <>
                <FormControl mb={4} isRequired>
                  <FormLabel>Contract Hash</FormLabel>
                  <Select
                    value={eventContract}
                    onChange={(e) => setEventContract(e.target.value)}
                  >
                    <option value="">Select a contract</option>
                    {contracts.map((contract) => (
                      <option key={contract.hash} value={contract.hash}>
                        {contract.name} ({contract.hash.substring(0, 8)}...)
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl mb={4} isRequired>
                  <FormLabel>Event Name</FormLabel>
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g., Transfer"
                  />
                </FormControl>
              </>
            )}

            <Divider my={4} />

            <Heading size="sm" mb={3}>Contract Action</Heading>

            <FormControl mb={4} isRequired>
              <FormLabel>Contract</FormLabel>
              <Select
                value={newTrigger.actions.contract_hash}
                onChange={(e) => setNewTrigger({
                  ...newTrigger,
                  actions: { ...newTrigger.actions, contract_hash: e.target.value }
                })}
              >
                <option value="">Select a contract</option>
                {contracts.map((contract) => (
                  <option key={contract.hash} value={contract.hash}>
                    {contract.name} ({contract.hash.substring(0, 8)}...)
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl mb={4} isRequired>
              <FormLabel>Method</FormLabel>
              <Input
                value={newTrigger.actions.method}
                onChange={(e) => setNewTrigger({
                  ...newTrigger,
                  actions: { ...newTrigger.actions, method: e.target.value }
                })}
                placeholder="e.g., executeAutomation"
              />
            </FormControl>

            <FormControl mb={4} display="flex" alignItems="center">
              <FormLabel mb="0">
                Enable Trigger
              </FormLabel>
              <Switch
                isChecked={newTrigger.enabled}
                onChange={(e) => setNewTrigger({ ...newTrigger, enabled: e.target.checked })}
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onTriggerModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={selectedTrigger ? handleUpdateTrigger : handleCreateTrigger}
            >
              {selectedTrigger ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={isHistoryModalOpen} onClose={onHistoryModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Execution History</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedTrigger && (
              <Box mb={4}>
                <Text fontWeight="bold">{selectedTrigger.name}</Text>
                <Text fontSize="sm">{selectedTrigger.description}</Text>
                <Divider my={3} />
              </Box>
            )}

            {executionHistory.length === 0 ? (
              <Box textAlign="center" py={6}>
                <Text>No execution history found for this trigger.</Text>
              </Box>
            ) : (
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Timestamp</Th>
                    <Th>Status</Th>
                    <Th>Result</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {executionHistory.map((execution, index) => (
                    <Tr key={index}>
                      <Td>{formatDate(execution.timestamp)}</Td>
                      <Td>{getStatusBadge(execution.status)}</Td>
                      <Td>
                        <Tooltip label={execution.result || 'No result'} placement="top">
                          <Text noOfLines={1} maxWidth="200px">
                            {execution.result || 'No result'}
                          </Text>
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onHistoryModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Register Contract Modal */}
      <Modal isOpen={isContractModalOpen} onClose={onContractModalClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Register Contract</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Alert status="info" mb={4}>
              <AlertIcon />
              <Text fontSize="sm">
                Register your Neo N3 contract to enable automation. The contract must implement the automation interface.
              </Text>
            </Alert>

            <FormControl mb={4} isRequired>
              <FormLabel>Contract Name</FormLabel>
              <Input 
                placeholder="MyContract"
              />
            </FormControl>

            <FormControl mb={4} isRequired>
              <FormLabel>Contract Hash</FormLabel>
              <Input 
                placeholder="0x1234..."
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Description</FormLabel>
              <Textarea 
                placeholder="Description of the contract's purpose"
                rows={3}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>ABI (JSON)</FormLabel>
              <Textarea 
                placeholder='{"methods": [...]}'
                rows={4}
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onContractModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={() => handleRegisterContract({
                name: "Sample Contract",
                hash: "0x1234567890abcdef",
                description: "Sample contract for testing",
                abi: "{}"
              })}
            >
              Register
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Examples Modal */}
      <Modal isOpen={isExamplesModalOpen} onClose={onExamplesModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Contract Integration Examples</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {integrationExamples ? (
              <Tabs variant="soft-rounded" colorScheme="blue">
                <TabList mb={4}>
                  <Tab>Basic Implementation</Tab>
                  <Tab>Advanced Implementation</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <CodeBlock
                      code={integrationExamples.basic || 
                        `public static bool ExecuteAutomation(string functionName)
{
    // Only allow the Service Layer to call this function
    if (!Runtime.CheckWitness(ServiceLayerAccount))
        return false;
        
    // Execute specific function based on the name
    if (functionName == "dailyUpdate")
        return DailyUpdate();
    else if (functionName == "weeklyReport")
        return WeeklyReport();
        
    return false;
}`}
                      language="csharp"
                    />
                  </TabPanel>
                  <TabPanel>
                    <CodeBlock
                      code={integrationExamples.advanced ||
                        `public static bool ExecuteAutomation(string functionName, object[] args)
{
    // Only allow the Service Layer to call this function
    if (!Runtime.CheckWitness(ServiceLayerAccount))
        return false;
        
    // Execute specific function based on the name and args
    if (functionName == "priceAlert")
    {
        BigInteger price = (BigInteger)args[0];
        string direction = (string)args[1];
        return HandlePriceAlert(price, direction);
    }
    else if (functionName == "transferEvent")
    {
        UInt160 from = (UInt160)args[0];
        UInt160 to = (UInt160)args[1];
        BigInteger amount = (BigInteger)args[2];
        return HandleTransferEvent(from, to, amount);
    }
        
    return false;
}`}
                      language="csharp"
                    />
                  </TabPanel>
                </TabPanels>
              </Tabs>
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

export default Automation; 
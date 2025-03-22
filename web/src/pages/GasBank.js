import React, { useState, useEffect } from 'react';
import {
  Box, Heading, Text, Flex, Button, Tabs, TabList, TabPanels, Tab, TabPanel,
  Table, Thead, Tbody, Tr, Th, Td, Badge, useDisclosure, Spinner,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  FormControl, FormLabel, Input, NumberInput, NumberInputField, NumberInputStepper, 
  NumberIncrementStepper, NumberDecrementStepper, useToast, SimpleGrid, 
  Stat, StatLabel, StatNumber, StatHelpText, StatArrow, IconButton,
  Alert, AlertIcon, Tooltip, Divider, InputGroup, InputRightAddon
} from '@chakra-ui/react';
import { 
  FiRefreshCw, FiDownload, FiUpload, FiCopy, FiInfo, FiArrowUp, FiArrowDown
} from 'react-icons/fi';
import gasBankService from '../services/gasBankService';
import transactionService from '../services/transactionService';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip as ChartTooltip, 
  Legend 
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

const GasBank = () => {
  // State variables
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [depositAddress, setDepositAddress] = useState('');
  const [serviceUsage, setServiceUsage] = useState([]);
  const [operationEstimates, setOperationEstimates] = useState([]);
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalFees: 0,
    averageTransactionCost: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Form state
  const [depositAmount, setDepositAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawAddress, setWithdrawAddress] = useState('');

  // Modal controls
  const { 
    isOpen: isDepositModalOpen, 
    onOpen: onDepositModalOpen, 
    onClose: onDepositModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isWithdrawModalOpen, 
    onOpen: onWithdrawModalOpen, 
    onClose: onWithdrawModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isTransactionModalOpen, 
    onOpen: onTransactionModalOpen, 
    onClose: onTransactionModalClose 
  } = useDisclosure();

  const toast = useToast();

  // Load data
  useEffect(() => {
    fetchBalance();
    fetchTransactions();
    fetchDepositAddress();
    fetchServiceUsage();
    fetchOperationEstimates();
    fetchStats();
  }, []);

  const fetchBalance = async () => {
    setIsLoading(true);
    try {
      const response = await gasBankService.getBalance();
      setBalance(response.data?.balance || 0);
    } catch (error) {
      toast({
        title: 'Error fetching balance',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await gasBankService.getTransactions();
      setTransactions(response.data || []);
    } catch (error) {
      toast({
        title: 'Error fetching transactions',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const fetchDepositAddress = async () => {
    try {
      const response = await gasBankService.getDepositAddress();
      setDepositAddress(response.data?.address || '');
    } catch (error) {
      console.error('Error fetching deposit address:', error);
    }
  };

  const fetchServiceUsage = async () => {
    try {
      const response = await gasBankService.getServiceUsage();
      setServiceUsage(response.data || []);
    } catch (error) {
      console.error('Error fetching service usage:', error);
    }
  };

  const fetchOperationEstimates = async () => {
    try {
      const response = await gasBankService.getOperationEstimates();
      setOperationEstimates(response.data || []);
    } catch (error) {
      console.error('Error fetching operation estimates:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await gasBankService.getStats();
      setStats(response.data || {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalFees: 0,
        averageTransactionCost: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDeposit = async () => {
    try {
      const depositData = {
        amount: parseFloat(depositAmount),
        // Additional data would be provided here in a real implementation
      };
      
      await gasBankService.deposit(depositData);
      
      toast({
        title: 'Deposit initiated',
        description: `Please transfer ${depositAmount} GAS to the displayed address.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      fetchBalance();
      fetchTransactions();
      onDepositModalClose();
      setDepositAmount(0);
    } catch (error) {
      toast({
        title: 'Deposit failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleWithdraw = async () => {
    try {
      if (!withdrawAddress) {
        toast({
          title: 'Withdrawal address required',
          description: 'Please enter a valid NEO address for withdrawal',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
        return;
      }
      
      const withdrawData = {
        amount: parseFloat(withdrawAmount),
        address: withdrawAddress
      };
      
      await gasBankService.withdraw(withdrawData);
      
      toast({
        title: 'Withdrawal successful',
        description: `${withdrawAmount} GAS has been sent to ${withdrawAddress}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      fetchBalance();
      fetchTransactions();
      onWithdrawModalClose();
      setWithdrawAmount(0);
      setWithdrawAddress('');
    } catch (error) {
      toast({
        title: 'Withdrawal failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const viewTransactionDetails = async (id) => {
    try {
      const response = await gasBankService.getTransaction(id);
      setSelectedTransaction(response.data);
      onTransactionModalOpen();
    } catch (error) {
      toast({
        title: 'Error fetching transaction details',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'DEPOSIT':
        return 'green';
      case 'WITHDRAWAL':
        return 'red';
      case 'FEE':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getTransactionTypeBadge = (type) => {
    return (
      <Badge colorScheme={getTransactionTypeColor(type)}>
        {type.charAt(0) + type.slice(1).toLowerCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge colorScheme="green">Completed</Badge>;
      case 'PENDING':
        return <Badge colorScheme="yellow">Pending</Badge>;
      case 'FAILED':
        return <Badge colorScheme="red">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Prepare chart data
  const usageChartData = {
    labels: serviceUsage.map(item => item.service),
    datasets: [
      {
        label: 'GAS Used',
        data: serviceUsage.map(item => item.amount),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
    ],
  };

  const usageChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Gas Usage by Service',
      },
    },
  };

  return (
    <Box p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={4}>
        <Heading size="lg">Gas Bank</Heading>
        <Flex>
          <Button 
            leftIcon={<FiDownload />} 
            colorScheme="blue" 
            mr={2}
            onClick={onDepositModalOpen}
          >
            Deposit
          </Button>
          <Button 
            leftIcon={<FiUpload />} 
            colorScheme="blue" 
            onClick={onWithdrawModalOpen}
            isDisabled={balance <= 0}
          >
            Withdraw
          </Button>
        </Flex>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={5} mb={6}>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Current Balance</StatLabel>
          <StatNumber>{balance.toFixed(8)} GAS</StatNumber>
          <StatHelpText>
            Available for services
          </StatHelpText>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Total Deposits</StatLabel>
          <StatNumber>{stats.totalDeposits.toFixed(8)} GAS</StatNumber>
          <StatHelpText>
            <StatArrow type="increase" />
            Lifetime
          </StatHelpText>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Total Withdrawals</StatLabel>
          <StatNumber>{stats.totalWithdrawals.toFixed(8)} GAS</StatNumber>
          <StatHelpText>
            <StatArrow type="decrease" />
            Lifetime
          </StatHelpText>
        </Stat>
        <Stat bg="white" p={3} borderRadius="md" boxShadow="sm">
          <StatLabel>Total Gas Fees</StatLabel>
          <StatNumber>{stats.totalFees.toFixed(8)} GAS</StatNumber>
          <StatHelpText>
            Service operations
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      <Tabs variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>Transactions</Tab>
          <Tab>Usage & Estimates</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Flex justifyContent="flex-end" mb={4}>
              <Button 
                leftIcon={<FiRefreshCw />} 
                variant="outline" 
                onClick={fetchTransactions}
                isLoading={isLoading}
              >
                Refresh
              </Button>
            </Flex>

            {isLoading ? (
              <Flex justifyContent="center" alignItems="center" h="200px">
                <Spinner />
              </Flex>
            ) : transactions.length === 0 ? (
              <Box textAlign="center" p={6} bg="white" borderRadius="md">
                <Text mb={4}>No transactions found. Deposit GAS to get started.</Text>
                <Button onClick={onDepositModalOpen} colorScheme="blue">
                  Deposit GAS
                </Button>
              </Box>
            ) : (
              <Table variant="simple" bg="white">
                <Thead>
                  <Tr>
                    <Th>ID</Th>
                    <Th>Type</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {transactions.map((tx) => (
                    <Tr key={tx.id}>
                      <Td>{tx.id}</Td>
                      <Td>{getTransactionTypeBadge(tx.type)}</Td>
                      <Td>
                        <Flex align="center">
                          {tx.type === 'DEPOSIT' ? (
                            <FiArrowDown color="green" style={{ marginRight: '8px' }} />
                          ) : (
                            <FiArrowUp color="red" style={{ marginRight: '8px' }} />
                          )}
                          {tx.amount.toFixed(8)} GAS
                        </Flex>
                      </Td>
                      <Td>{getStatusBadge(tx.status)}</Td>
                      <Td>{formatDate(tx.created_at)}</Td>
                      <Td>
                        <Tooltip label="View Details">
                          <IconButton 
                            icon={<FiInfo />} 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => viewTransactionDetails(tx.id)} 
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
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
                <Heading size="md" mb={4}>Gas Usage by Service</Heading>
                <Box height="300px">
                  {serviceUsage.length > 0 ? (
                    <Line data={usageChartData} options={usageChartOptions} />
                  ) : (
                    <Flex justify="center" align="center" height="100%">
                      <Text>No usage data available</Text>
                    </Flex>
                  )}
                </Box>
              </Box>

              <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
                <Heading size="md" mb={4}>Operation Cost Estimates</Heading>
                {operationEstimates.length > 0 ? (
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Operation</Th>
                        <Th>Estimated Gas</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {operationEstimates.map((estimate, index) => (
                        <Tr key={index}>
                          <Td>{estimate.operation}</Td>
                          <Td>{estimate.gas_estimate.toFixed(8)} GAS</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ) : (
                  <Flex justify="center" align="center" height="200px">
                    <Text>No estimate data available</Text>
                  </Flex>
                )}
              </Box>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Deposit Modal */}
      <Modal isOpen={isDepositModalOpen} onClose={onDepositModalClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Deposit GAS</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Alert status="info" mb={4}>
              <AlertIcon />
              <Text fontSize="sm">
                To deposit GAS, send it to the address below. Your account will be credited after the transaction is confirmed.
              </Text>
            </Alert>

            <FormControl mb={4}>
              <FormLabel>Deposit Address</FormLabel>
              <InputGroup>
                <Input value={depositAddress} isReadOnly />
                <InputRightAddon 
                  children={<FiCopy />} 
                  cursor="pointer" 
                  onClick={() => copyToClipboard(depositAddress)}
                />
              </InputGroup>
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>Amount (GAS)</FormLabel>
              <NumberInput min={0.00000001} precision={8} value={depositAmount} onChange={(valueString) => setDepositAmount(valueString)}>
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>

            <Divider my={4} />
            
            <Text fontSize="sm" color="gray.600">
              Note: Minimum deposit is 0.00000001 GAS. Deposits may take up to 10 minutes to be credited to your account after network confirmation.
            </Text>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDepositModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleDeposit}
              isDisabled={depositAmount <= 0}
            >
              Confirm Deposit
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Withdraw Modal */}
      <Modal isOpen={isWithdrawModalOpen} onClose={onWithdrawModalClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Withdraw GAS</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Alert status="warning" mb={4}>
              <AlertIcon />
              <Text fontSize="sm">
                Withdrawals are processed immediately. Please double-check the destination address.
              </Text>
            </Alert>

            <FormControl mb={4} isRequired>
              <FormLabel>Withdrawal Address</FormLabel>
              <Input 
                value={withdrawAddress} 
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="NEO N3 address"
              />
            </FormControl>

            <FormControl mb={4} isRequired>
              <FormLabel>Amount (GAS)</FormLabel>
              <NumberInput 
                min={0.00000001} 
                max={balance} 
                precision={8} 
                value={withdrawAmount} 
                onChange={(valueString) => setWithdrawAmount(valueString)}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <FormControl.HelperText>
                Available balance: {balance.toFixed(8)} GAS
              </FormControl.HelperText>
            </FormControl>

            <Divider my={4} />
            
            <Text fontSize="sm" color="gray.600">
              Note: A small network fee will be deducted from your withdrawal amount. Minimum withdrawal is 0.00000001 GAS.
            </Text>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onWithdrawModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleWithdraw}
              isDisabled={withdrawAmount <= 0 || withdrawAmount > balance || !withdrawAddress}
            >
              Withdraw
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Transaction Details Modal */}
      <Modal isOpen={isTransactionModalOpen} onClose={onTransactionModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Transaction Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedTransaction && (
              <SimpleGrid columns={2} spacing={4}>
                <Box>
                  <Text fontWeight="bold">Transaction ID:</Text>
                  <Text>{selectedTransaction.id}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Type:</Text>
                  <Text>{getTransactionTypeBadge(selectedTransaction.type)}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Amount:</Text>
                  <Text>{selectedTransaction.amount.toFixed(8)} GAS</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Status:</Text>
                  <Text>{getStatusBadge(selectedTransaction.status)}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Created At:</Text>
                  <Text>{formatDate(selectedTransaction.created_at)}</Text>
                </Box>
                <Box>
                  <Text fontWeight="bold">Updated At:</Text>
                  <Text>{formatDate(selectedTransaction.updated_at)}</Text>
                </Box>
                
                {selectedTransaction.address && (
                  <Box gridColumn="span 2">
                    <Text fontWeight="bold">Address:</Text>
                    <Text>{selectedTransaction.address}</Text>
                  </Box>
                )}
                
                {selectedTransaction.tx_hash && (
                  <Box gridColumn="span 2">
                    <Text fontWeight="bold">Transaction Hash:</Text>
                    <Flex alignItems="center">
                      <Text 
                        as="a" 
                        href={`https://neo3.neotube.io/transaction/${selectedTransaction.tx_hash}`} 
                        target="_blank" 
                        color="blue.500" 
                        mr={2}
                      >
                        {selectedTransaction.tx_hash}
                      </Text>
                      <IconButton 
                        icon={<FiCopy />} 
                        size="xs" 
                        onClick={() => copyToClipboard(selectedTransaction.tx_hash)} 
                        aria-label="Copy hash"
                      />
                    </Flex>
                  </Box>
                )}
                
                {selectedTransaction.service && (
                  <Box gridColumn="span 2">
                    <Text fontWeight="bold">Service:</Text>
                    <Text>{selectedTransaction.service}</Text>
                  </Box>
                )}
                
                {selectedTransaction.description && (
                  <Box gridColumn="span 2">
                    <Text fontWeight="bold">Description:</Text>
                    <Text>{selectedTransaction.description}</Text>
                  </Box>
                )}
                
                {selectedTransaction.error && (
                  <Box gridColumn="span 2">
                    <Alert status="error">
                      <AlertIcon />
                      <Box>
                        <Text fontWeight="bold">Error:</Text>
                        <Text>{selectedTransaction.error}</Text>
                      </Box>
                    </Alert>
                  </Box>
                )}
              </SimpleGrid>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onTransactionModalClose}>
              Close
            </Button>
            {selectedTransaction && selectedTransaction.tx_hash && (
              <Button 
                as="a"
                href={`https://neo3.neotube.io/transaction/${selectedTransaction.tx_hash}`}
                target="_blank"
                variant="outline"
              >
                View on Explorer
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default GasBank; 
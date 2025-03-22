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
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Textarea,
  useToast,
  Spinner,
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
  Code,
  Link,
  HStack,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { 
  AddIcon, 
  RepeatIcon, 
  ExternalLinkIcon, 
  InfoIcon,
  CheckCircleIcon,
  WarningIcon,
  ViewIcon,
  CopyIcon,
} from '@chakra-ui/icons';

// Import the random number service
import randomNumberService from '../services/randomNumberService';

const RandomNumber = () => {
  const [randomRequests, setRandomRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
  });
  const [proof, setProof] = useState(null);
  const [examples, setExamples] = useState(null);
  const [formData, setFormData] = useState({
    contractAddress: '',
    callback: '',
    min: 1,
    max: 100,
    numValues: 1,
    userSeed: '',
    description: '',
  });

  // UI states
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();
  const { isOpen: isExamplesOpen, onOpen: onExamplesOpen, onClose: onExamplesClose } = useDisclosure();
  const toast = useToast();

  // Fetch random number requests when component mounts
  useEffect(() => {
    fetchRandomRequests();
    fetchStats();
  }, []);

  // Fetch random number requests
  const fetchRandomRequests = async () => {
    setIsLoading(true);
    try {
      const data = await randomNumberService.listRandomNumberRequests();
      setRandomRequests(data);
    } catch (error) {
      console.error('Error fetching random number requests:', error);
      toast({
        title: 'Error fetching requests',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch random number stats
  const fetchStats = async () => {
    try {
      const data = await randomNumberService.getRandomNumberStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching random number stats:', error);
    }
  };

  // Fetch examples
  const fetchExamples = async () => {
    if (examples) return; // Only fetch once
    
    try {
      const data = await randomNumberService.getContractIntegrationExamples();
      setExamples(data);
    } catch (error) {
      console.error('Error fetching examples:', error);
      toast({
        title: 'Error fetching examples',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Fetch proof for a random number
  const fetchProof = async (id) => {
    try {
      const data = await randomNumberService.getRandomNumberProof(id);
      setProof(data);
    } catch (error) {
      console.error('Error fetching proof:', error);
      toast({
        title: 'Error fetching proof',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
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
      await randomNumberService.generateRandomNumber(formData);
      toast({
        title: 'Random number requested',
        description: 'Your random number request has been submitted.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Reset form and refresh data
      resetForm();
      fetchRandomRequests();
      fetchStats();
      onModalClose();
    } catch (error) {
      console.error('Error requesting random number:', error);
      toast({
        title: 'Error requesting random number',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      contractAddress: '',
      callback: '',
      min: 1,
      max: 100,
      numValues: 1,
      userSeed: '',
      description: '',
    });
  };

  // Handle view details
  const handleViewDetails = async (request) => {
    setSelectedRequest(request);
    setProof(null); // Reset proof
    setVerificationResult(null); // Reset verification
    onDetailsOpen();

    // If the request is completed, fetch the proof
    if (request.status === 'completed') {
      fetchProof(request.id);
    }
  };

  // Handle verify
  const handleVerify = async () => {
    if (!selectedRequest || !proof) return;

    setIsVerifying(true);
    try {
      const data = await randomNumberService.verifyRandomNumber(selectedRequest.id, {
        proof: proof,
      });
      setVerificationResult(data);
      
      toast({
        title: data.verified ? 'Verification successful' : 'Verification failed',
        description: data.message,
        status: data.verified ? 'success' : 'error',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error verifying random number:', error);
      toast({
        title: 'Error verifying random number',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    switch (status) {
      case 'completed':
        return <Badge colorScheme="green">Completed</Badge>;
      case 'pending':
      case 'processing':
        return <Badge colorScheme="yellow">Processing</Badge>;
      case 'failed':
        return <Badge colorScheme="red">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
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
        <Heading size="lg">Random Number Generator</Heading>
        <Flex>
          <Button
            leftIcon={<InfoIcon />}
            variant="outline"
            onClick={() => {
              fetchExamples();
              onExamplesOpen();
            }}
            mr={2}
          >
            Integration Examples
          </Button>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={onModalOpen}
          >
            Generate Random Number
          </Button>
        </Flex>
      </Flex>

      {/* Stats */}
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={6}>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Total Requests</StatLabel>
              <StatNumber>{stats.total}</StatNumber>
              <StatHelpText>All time</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Completed</StatLabel>
              <StatNumber>{stats.completed}</StatNumber>
              <StatHelpText>Successfully generated</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Pending</StatLabel>
              <StatNumber>{stats.pending}</StatNumber>
              <StatHelpText>In progress</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat>
              <StatLabel>Failed</StatLabel>
              <StatNumber>{stats.failed}</StatNumber>
              <StatHelpText>Error occurred</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Request Table */}
      {isLoading ? (
        <Flex justifyContent="center" my={8}>
          <Spinner size="xl" />
        </Flex>
      ) : randomRequests.length === 0 ? (
        <Box textAlign="center" my={8} p={6} borderWidth={1} borderRadius="md">
          <Text fontSize="lg" mb={4}>No random number requests available</Text>
          <Button colorScheme="blue" onClick={onModalOpen}>
            Generate your first random number
          </Button>
        </Box>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Description</Th>
                <Th>Range</Th>
                <Th>Values</Th>
                <Th>Status</Th>
                <Th>Requested</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {randomRequests.map((request) => (
                <Tr key={request.id}>
                  <Td>{request.id.substring(0, 8)}...</Td>
                  <Td>{request.description || 'N/A'}</Td>
                  <Td>{request.min} - {request.max}</Td>
                  <Td>{request.numValues}</Td>
                  <Td>
                    <StatusBadge status={request.status} />
                  </Td>
                  <Td>{formatTimeAgo(request.createdAt)}</Td>
                  <Td>
                    <Flex>
                      <Tooltip label="View Details">
                        <IconButton
                          icon={<ViewIcon />}
                          size="sm"
                          onClick={() => handleViewDetails(request)}
                          aria-label="View details"
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

      {/* Create Request Modal */}
      <Modal isOpen={isModalOpen} onClose={onModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Generate Random Number</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleSubmit}>
            <ModalBody>
              <Stack spacing={4}>
                <FormControl>
                  <FormLabel>Description (optional)</FormLabel>
                  <Input
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="e.g., Lottery Winner Selection"
                  />
                </FormControl>

                <SimpleGrid columns={2} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Minimum Value</FormLabel>
                    <NumberInput
                      min={0}
                      value={formData.min}
                      onChange={(valueString) =>
                        handleNumberChange('min', parseInt(valueString, 10))
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
                    <FormLabel>Maximum Value</FormLabel>
                    <NumberInput
                      min={formData.min + 1}
                      value={formData.max}
                      onChange={(valueString) =>
                        handleNumberChange('max', parseInt(valueString, 10))
                      }
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                </SimpleGrid>

                <FormControl isRequired>
                  <FormLabel>Number of Values</FormLabel>
                  <NumberInput
                    min={1}
                    max={10}
                    value={formData.numValues}
                    onChange={(valueString) =>
                      handleNumberChange('numValues', parseInt(valueString, 10))
                    }
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>User Seed (optional)</FormLabel>
                  <Input
                    name="userSeed"
                    value={formData.userSeed}
                    onChange={handleChange}
                    placeholder="Additional entropy for randomness"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Contract Address (optional)</FormLabel>
                  <Input
                    name="contractAddress"
                    value={formData.contractAddress}
                    onChange={handleChange}
                    placeholder="NEO N3 contract address"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Callback Method (optional)</FormLabel>
                  <Input
                    name="callback"
                    value={formData.callback}
                    onChange={handleChange}
                    placeholder="e.g., receiveRandom"
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
                Generate
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Random Number Details
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedRequest && (
              <Tabs isFitted variant="enclosed">
                <TabList>
                  <Tab>Overview</Tab>
                  <Tab>Result</Tab>
                  <Tab>Verification</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel>
                    <SimpleGrid columns={2} spacing={4}>
                      <Box>
                        <Text fontWeight="bold">Request ID:</Text>
                        <Text>{selectedRequest.id}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Status:</Text>
                        <StatusBadge status={selectedRequest.status} />
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Description:</Text>
                        <Text>{selectedRequest.description || 'N/A'}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Range:</Text>
                        <Text>{selectedRequest.min} - {selectedRequest.max}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Number of Values:</Text>
                        <Text>{selectedRequest.numValues}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">User Seed:</Text>
                        <Text>{selectedRequest.userSeed || 'None'}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Contract Address:</Text>
                        <Text>{selectedRequest.contractAddress || 'None'}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Callback Method:</Text>
                        <Text>{selectedRequest.callback || 'None'}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Created At:</Text>
                        <Text>{new Date(selectedRequest.createdAt).toLocaleString()}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">Completed At:</Text>
                        <Text>
                          {selectedRequest.completedAt
                            ? new Date(selectedRequest.completedAt).toLocaleString()
                            : 'Not completed'}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </TabPanel>

                  <TabPanel>
                    {selectedRequest.status === 'completed' ? (
                      <Box>
                        <Text fontWeight="bold" mb={2}>Random Values:</Text>
                        <Box 
                          p={4} 
                          borderWidth={1} 
                          borderRadius="md" 
                          bg="gray.50" 
                          position="relative"
                        >
                          <Text fontFamily="mono">{JSON.stringify(selectedRequest.result, null, 2)}</Text>
                          <IconButton
                            icon={<CopyIcon />}
                            size="sm"
                            position="absolute"
                            top={2}
                            right={2}
                            onClick={() => copyToClipboard(JSON.stringify(selectedRequest.result))}
                            aria-label="Copy result"
                          />
                        </Box>

                        {selectedRequest.txHash && (
                          <Box mt={4}>
                            <Text fontWeight="bold" mb={2}>Transaction Hash:</Text>
                            <Flex alignItems="center">
                              <Text fontFamily="mono">{selectedRequest.txHash}</Text>
                              <IconButton
                                icon={<ExternalLinkIcon />}
                                size="sm"
                                ml={2}
                                as={Link}
                                href={`https://neo3.testnet.neotube.io/transaction/${selectedRequest.txHash}`}
                                target="_blank"
                                aria-label="View on explorer"
                              />
                            </Flex>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Box textAlign="center" p={6}>
                        <Text>Results will be available once the request is completed.</Text>
                        <Text>Current status: <StatusBadge status={selectedRequest.status} /></Text>
                      </Box>
                    )}
                  </TabPanel>

                  <TabPanel>
                    {selectedRequest.status === 'completed' && proof ? (
                      <Box>
                        <Text mb={4}>Verify that the random number was generated securely and has not been tampered with.</Text>
                        
                        <Box mb={4}>
                          <Button
                            leftIcon={verificationResult?.verified ? <CheckCircleIcon /> : <RepeatIcon />}
                            colorScheme={verificationResult?.verified ? "green" : "blue"}
                            onClick={handleVerify}
                            isLoading={isVerifying}
                            mb={4}
                          >
                            {verificationResult?.verified ? "Verified Successfully" : "Verify Random Number"}
                          </Button>
                          
                          {verificationResult && (
                            <Box 
                              mt={2} 
                              p={4} 
                              borderWidth={1} 
                              borderRadius="md"
                              bg={verificationResult.verified ? "green.50" : "red.50"}
                            >
                              <HStack>
                                {verificationResult.verified 
                                  ? <CheckCircleIcon color="green.500" /> 
                                  : <WarningIcon color="red.500" />
                                }
                                <Text>{verificationResult.message}</Text>
                              </HStack>
                            </Box>
                          )}
                        </Box>
                        
                        <Accordion allowToggle>
                          <AccordionItem>
                            <h2>
                              <AccordionButton>
                                <Box flex="1" textAlign="left">
                                  View Proof Details
                                </Box>
                                <AccordionIcon />
                              </AccordionButton>
                            </h2>
                            <AccordionPanel pb={4}>
                              <Box 
                                p={4} 
                                borderWidth={1} 
                                borderRadius="md" 
                                bg="gray.50"
                                maxHeight="300px"
                                overflow="auto"
                              >
                                <pre>{JSON.stringify(proof, null, 2)}</pre>
                              </Box>
                            </AccordionPanel>
                          </AccordionItem>
                        </Accordion>
                      </Box>
                    ) : (
                      <Box textAlign="center" p={6}>
                        <Text>Verification is available only for completed requests.</Text>
                        <Text>Current status: <StatusBadge status={selectedRequest.status} /></Text>
                      </Box>
                    )}
                  </TabPanel>
                </TabPanels>
              </Tabs>
            )}
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" onClick={onDetailsClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Examples Modal */}
      <Modal isOpen={isExamplesOpen} onClose={onExamplesClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Integration Examples</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {examples ? (
              <Tabs variant="enclosed">
                <TabList>
                  <Tab>Neo N3 Smart Contract</Tab>
                  <Tab>API Integration</Tab>
                  <Tab>Verification</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel>
                    <Text mb={4}>
                      Sample Neo N3 smart contract that integrates with the Random Number service:
                    </Text>
                    <Box 
                      p={4} 
                      borderWidth={1} 
                      borderRadius="md" 
                      bg="gray.50"
                      position="relative"
                      fontFamily="mono"
                      fontSize="sm"
                      whiteSpace="pre-wrap"
                    >
                      <Code>{examples.neoContract}</Code>
                      <IconButton
                        icon={<CopyIcon />}
                        size="sm"
                        position="absolute"
                        top={2}
                        right={2}
                        onClick={() => copyToClipboard(examples.neoContract)}
                        aria-label="Copy code"
                      />
                    </Box>
                  </TabPanel>

                  <TabPanel>
                    <Text mb={4}>
                      Example for integrating with the Random Number service via API:
                    </Text>
                    <Box 
                      p={4} 
                      borderWidth={1} 
                      borderRadius="md" 
                      bg="gray.50"
                      position="relative"
                      fontFamily="mono"
                      fontSize="sm"
                      whiteSpace="pre-wrap"
                    >
                      <Code>{examples.apiIntegration}</Code>
                      <IconButton
                        icon={<CopyIcon />}
                        size="sm"
                        position="absolute"
                        top={2}
                        right={2}
                        onClick={() => copyToClipboard(examples.apiIntegration)}
                        aria-label="Copy code"
                      />
                    </Box>
                  </TabPanel>

                  <TabPanel>
                    <Text mb={4}>
                      Example for verifying a random number's proof:
                    </Text>
                    <Box 
                      p={4} 
                      borderWidth={1} 
                      borderRadius="md" 
                      bg="gray.50"
                      position="relative"
                      fontFamily="mono"
                      fontSize="sm"
                      whiteSpace="pre-wrap"
                    >
                      <Code>{examples.verification}</Code>
                      <IconButton
                        icon={<CopyIcon />}
                        size="sm"
                        position="absolute"
                        top={2}
                        right={2}
                        onClick={() => copyToClipboard(examples.verification)}
                        aria-label="Copy code"
                      />
                    </Box>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            ) : (
              <Flex justifyContent="center" my={8}>
                <Spinner size="xl" />
              </Flex>
            )}
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" onClick={onExamplesClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default RandomNumber; 
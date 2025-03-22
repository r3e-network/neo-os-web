import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Spinner,
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
  Textarea,
  Select,
  Stack,
  useToast,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { FiPlus, FiPlay, FiEdit, FiTrash2, FiMoreVertical, FiClock, FiList } from 'react-icons/fi';
import axios from 'axios';

// Mock data - replace with actual API calls
const mockFunctions = [
  {
    id: 1,
    name: 'getPriceData',
    description: 'Fetches price data from external sources',
    language: 'javascript',
    version: 1,
    created_at: '2023-03-01T10:30:00Z',
    updated_at: '2023-03-15T14:20:00Z',
    last_executed: '2023-03-20T08:45:00Z',
    status: 'active',
  },
  {
    id: 2,
    name: 'processPayment',
    description: 'Processes payment transactions on Neo N3',
    language: 'javascript',
    version: 3,
    created_at: '2023-02-15T09:20:00Z',
    updated_at: '2023-03-18T11:10:00Z',
    last_executed: '2023-03-21T09:15:00Z',
    status: 'active',
  },
  {
    id: 3,
    name: 'notifyUsers',
    description: 'Sends notifications to users',
    language: 'javascript',
    version: 2,
    created_at: '2023-01-20T16:40:00Z',
    updated_at: '2023-03-10T13:50:00Z',
    last_executed: '2023-03-19T15:30:00Z',
    status: 'active',
  },
  {
    id: 4,
    name: 'calculateMetrics',
    description: 'Calculates performance metrics',
    language: 'javascript',
    version: 1,
    created_at: '2023-03-05T11:15:00Z',
    updated_at: '2023-03-05T11:15:00Z',
    last_executed: null,
    status: 'inactive',
  },
];

// Sample function code
const defaultFunctionCode = `// This is a sample function
// Parameters are passed as arguments to the main function

function main(params) {
  // Access secrets (only within TEE)
  // const apiKey = secrets.get('my_api_key');
  
  // Your function logic here
  console.log('Function executed with params:', params);
  
  // Return results
  return {
    success: true,
    data: {
      message: 'Function executed successfully',
      timestamp: new Date().toISOString(),
      params: params
    }
  };
}`;

const Functions = () => {
  const [functions, setFunctions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [functionToDelete, setFunctionToDelete] = useState(null);
  const [executionParams, setExecutionParams] = useState('{\n  "param1": "value1",\n  "param2": 123\n}');
  const [executionResult, setExecutionResult] = useState(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    language: 'javascript',
    source: defaultFunctionCode,
  });

  // Modal states
  const { 
    isOpen: isCreateModalOpen, 
    onOpen: onCreateModalOpen, 
    onClose: onCreateModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isEditModalOpen, 
    onOpen: onEditModalOpen, 
    onClose: onEditModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isExecuteModalOpen, 
    onOpen: onExecuteModalOpen, 
    onClose: onExecuteModalClose 
  } = useDisclosure();
  
  const { 
    isOpen: isDeleteAlertOpen, 
    onOpen: onDeleteAlertOpen, 
    onClose: onDeleteAlertClose 
  } = useDisclosure();

  const toast = useToast();
  const cancelRef = React.useRef();
  
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Load functions on component mount
  useEffect(() => {
    fetchFunctions();
  }, []);

  // Fetch functions from API
  const fetchFunctions = async () => {
    setIsLoading(true);
    
    try {
      // In a real app, use API call
      // const response = await axios.get('/api/v1/functions');
      // setFunctions(response.data);
      
      // Using mock data for now
      setTimeout(() => {
        setFunctions(mockFunctions);
        setIsLoading(false);
      }, 800);
    } catch (error) {
      console.error('Error fetching functions:', error);
      toast({
        title: 'Error fetching functions',
        description: error.message || 'Failed to load functions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
    }
  };

  // Handle create function
  const handleCreateFunction = async () => {
    try {
      // In a real app, use API call
      // const response = await axios.post('/api/v1/functions', formData);
      // const newFunction = response.data;
      
      // Mock successful creation
      const newFunction = {
        id: functions.length + 1,
        ...formData,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_executed: null,
        status: 'active',
      };
      
      setFunctions([...functions, newFunction]);
      
      toast({
        title: 'Function created',
        description: `Function "${formData.name}" created successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        language: 'javascript',
        source: defaultFunctionCode,
      });
      onCreateModalClose();
    } catch (error) {
      console.error('Error creating function:', error);
      toast({
        title: 'Error creating function',
        description: error.message || 'Failed to create function',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle edit function
  const handleEditFunction = async () => {
    if (!selectedFunction) return;
    
    try {
      // In a real app, use API call
      // const response = await axios.put(`/api/v1/functions/${selectedFunction.id}`, formData);
      // const updatedFunction = response.data;
      
      // Mock successful update
      const updatedFunction = {
        ...selectedFunction,
        ...formData,
        version: selectedFunction.version + 1,
        updated_at: new Date().toISOString(),
      };
      
      setFunctions(functions.map(f => f.id === updatedFunction.id ? updatedFunction : f));
      
      toast({
        title: 'Function updated',
        description: `Function "${formData.name}" updated successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setSelectedFunction(null);
      onEditModalClose();
    } catch (error) {
      console.error('Error updating function:', error);
      toast({
        title: 'Error updating function',
        description: error.message || 'Failed to update function',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle delete function
  const handleDeleteFunction = async () => {
    if (!functionToDelete) return;
    
    try {
      // In a real app, use API call
      // await axios.delete(`/api/v1/functions/${functionToDelete.id}`);
      
      // Update local state
      setFunctions(functions.filter(f => f.id !== functionToDelete.id));
      
      toast({
        title: 'Function deleted',
        description: `Function "${functionToDelete.name}" deleted successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset state and close alert
      setFunctionToDelete(null);
      onDeleteAlertClose();
    } catch (error) {
      console.error('Error deleting function:', error);
      toast({
        title: 'Error deleting function',
        description: error.message || 'Failed to delete function',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle execute function
  const handleExecuteFunction = async () => {
    if (!selectedFunction) return;
    
    setExecutionLoading(true);
    setExecutionResult(null);
    
    try {
      // Parse execution parameters
      let params = {};
      try {
        params = JSON.parse(executionParams);
      } catch (e) {
        throw new Error('Invalid JSON in execution parameters');
      }
      
      // In a real app, use API call
      // const response = await axios.post(`/api/v1/functions/${selectedFunction.id}/execute`, { params });
      // const result = response.data;
      
      // Mock successful execution
      setTimeout(() => {
        const result = {
          execution_id: `exec_${Date.now()}`,
          function_id: selectedFunction.id,
          status: 'success',
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration: 123, // ms
          result: {
            success: true,
            data: {
              message: 'Function executed successfully',
              timestamp: new Date().toISOString(),
              params: params
            }
          },
          logs: [
            'Function execution started',
            'Processing parameters...',
            `Function executed with params: ${JSON.stringify(params)}`,
            'Execution completed successfully'
          ]
        };
        
        setExecutionResult(result);
        setExecutionLoading(false);
        
        // Update function's last_executed time
        const updatedFunction = {
          ...selectedFunction,
          last_executed: new Date().toISOString(),
        };
        
        setFunctions(functions.map(f => f.id === updatedFunction.id ? updatedFunction : f));
      }, 1500);
    } catch (error) {
      console.error('Error executing function:', error);
      toast({
        title: 'Error executing function',
        description: error.message || 'Failed to execute function',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setExecutionLoading(false);
    }
  };

  // Open edit modal and set selected function
  const openEditModal = (func) => {
    setSelectedFunction(func);
    setFormData({
      name: func.name,
      description: func.description,
      language: func.language,
      source: func.source || defaultFunctionCode,
    });
    onEditModalOpen();
  };

  // Open execute modal and set selected function
  const openExecuteModal = (func) => {
    setSelectedFunction(func);
    setExecutionParams('{\n  "param1": "value1",\n  "param2": 123\n}');
    setExecutionResult(null);
    onExecuteModalOpen();
  };

  // Open delete alert and set function to delete
  const openDeleteAlert = (func) => {
    setFunctionToDelete(func);
    onDeleteAlertOpen();
  };

  // Format date string
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    return date.toLocaleString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Functions</Heading>
        <Button 
          leftIcon={<FiPlus />} 
          colorScheme="brand" 
          onClick={onCreateModalOpen}
        >
          Create Function
        </Button>
      </Flex>

      {/* Functions table */}
      <Box
        bg={cardBg}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={borderColor}
        overflow="hidden"
        boxShadow="sm"
      >
        {isLoading ? (
          <Flex justify="center" align="center" p={8}>
            <Spinner size="lg" color="brand.500" />
          </Flex>
        ) : functions.length === 0 ? (
          <Flex direction="column" align="center" justify="center" p={8} textAlign="center">
            <Text fontSize="lg" mb={4}>No functions found</Text>
            <Button 
              leftIcon={<FiPlus />} 
              colorScheme="brand" 
              onClick={onCreateModalOpen}
            >
              Create your first function
            </Button>
          </Flex>
        ) : (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Version</Th>
                <Th>Last Executed</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {functions.map((func) => (
                <Tr key={func.id}>
                  <Td fontWeight="medium">{func.name}</Td>
                  <Td>{func.description}</Td>
                  <Td>v{func.version}</Td>
                  <Td>{formatDate(func.last_executed)}</Td>
                  <Td>
                    <Badge 
                      colorScheme={func.status === 'active' ? 'green' : 'gray'}
                      borderRadius="full"
                      px={2}
                    >
                      {func.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Flex>
                      <IconButton
                        icon={<FiPlay />}
                        aria-label="Execute function"
                        size="sm"
                        colorScheme="brand"
                        variant="ghost"
                        mr={2}
                        onClick={() => openExecuteModal(func)}
                      />
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<FiMoreVertical />}
                          variant="ghost"
                          size="sm"
                          aria-label="More options"
                        />
                        <MenuList>
                          <MenuItem icon={<FiEdit />} onClick={() => openEditModal(func)}>
                            Edit
                          </MenuItem>
                          <MenuItem icon={<FiPlay />} onClick={() => openExecuteModal(func)}>
                            Execute
                          </MenuItem>
                          <MenuItem icon={<FiClock />}>
                            Execution History
                          </MenuItem>
                          <MenuItem icon={<FiTrash2 />} color="red.500" onClick={() => openDeleteAlert(func)}>
                            Delete
                          </MenuItem>
                        </MenuList>
                      </Menu>
                    </Flex>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>

      {/* Create Function Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Function</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Function Name</FormLabel>
                <Input 
                  placeholder="Enter function name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea 
                  placeholder="Enter function description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Language</FormLabel>
                <Select 
                  value={formData.language}
                  onChange={(e) => setFormData({...formData, language: e.target.value})}
                >
                  <option value="javascript">JavaScript</option>
                </Select>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Source Code</FormLabel>
                <Textarea 
                  placeholder="// Write your function code here"
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  minHeight="200px"
                  fontFamily="monospace"
                />
              </FormControl>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="brand" 
              onClick={handleCreateFunction}
              isDisabled={!formData.name || !formData.source}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Function Modal */}
      <Modal isOpen={isEditModalOpen} onClose={onEditModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Function: {selectedFunction?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Function Name</FormLabel>
                <Input 
                  placeholder="Enter function name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea 
                  placeholder="Enter function description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Language</FormLabel>
                <Select 
                  value={formData.language}
                  onChange={(e) => setFormData({...formData, language: e.target.value})}
                >
                  <option value="javascript">JavaScript</option>
                </Select>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Source Code</FormLabel>
                <Textarea 
                  placeholder="// Write your function code here"
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  minHeight="200px"
                  fontFamily="monospace"
                />
              </FormControl>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="brand" 
              onClick={handleEditFunction}
              isDisabled={!formData.name || !formData.source}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Execute Function Modal */}
      <Modal isOpen={isExecuteModalOpen} onClose={onExecuteModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Execute Function: {selectedFunction?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Parameters (JSON)</FormLabel>
                <Textarea 
                  placeholder='{"param1": "value1", "param2": 123}'
                  value={executionParams}
                  onChange={(e) => setExecutionParams(e.target.value)}
                  minHeight="120px"
                  fontFamily="monospace"
                />
              </FormControl>
              
              {executionResult && (
                <Box 
                  p={4} 
                  borderRadius="md" 
                  bg={useColorModeValue('gray.50', 'gray.700')}
                  borderWidth="1px"
                  borderColor={borderColor}
                >
                  <Text fontWeight="bold" mb={2}>Execution Result:</Text>
                  <Box 
                    p={3} 
                    bg={useColorModeValue('white', 'gray.800')} 
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={borderColor}
                    fontFamily="monospace"
                    fontSize="sm"
                    mb={4}
                    overflowX="auto"
                  >
                    <pre>{JSON.stringify(executionResult.result, null, 2)}</pre>
                  </Box>
                  
                  <Text fontWeight="bold" mb={2}>Logs:</Text>
                  <Box 
                    p={3} 
                    bg={useColorModeValue('white', 'gray.800')} 
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={borderColor}
                    fontFamily="monospace"
                    fontSize="sm"
                    overflowX="auto"
                  >
                    {executionResult.logs.map((log, index) => (
                      <Text key={index}>{log}</Text>
                    ))}
                  </Box>
                  
                  <Flex mt={2} fontSize="sm" color="gray.500" justify="space-between">
                    <Text>Duration: {executionResult.duration}ms</Text>
                    <Text>Status: {executionResult.status}</Text>
                  </Flex>
                </Box>
              )}
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onExecuteModalClose}>
              Close
            </Button>
            <Button 
              colorScheme="brand" 
              onClick={handleExecuteFunction}
              isLoading={executionLoading}
              loadingText="Executing"
            >
              Execute
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Function
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete the function "{functionToDelete?.name}"? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteAlertClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteFunction} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default Functions; 
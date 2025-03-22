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
  InputGroup,
  InputRightElement,
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
  Tooltip,
} from '@chakra-ui/react';
import { 
  FiPlus, 
  FiEye, 
  FiEyeOff, 
  FiEdit, 
  FiTrash2, 
  FiMoreVertical, 
  FiCopy,
  FiAlertTriangle,
} from 'react-icons/fi';
import axios from 'axios';

// Mock data - replace with actual API calls
const mockSecrets = [
  {
    id: 1,
    name: 'exchange_api_key',
    description: 'API key for accessing exchange data',
    created_at: '2023-02-10T08:30:00Z',
    updated_at: '2023-03-05T14:20:00Z',
    used_by: ['getPriceData'],
    environment: 'production',
  },
  {
    id: 2,
    name: 'payment_gateway_secret',
    description: 'Secret for payment gateway integration',
    created_at: '2023-01-15T11:45:00Z',
    updated_at: '2023-03-08T09:15:00Z',
    used_by: ['processPayment'],
    environment: 'production',
  },
  {
    id: 3,
    name: 'notification_service_token',
    description: 'Token for notification service',
    created_at: '2023-02-20T16:20:00Z',
    updated_at: '2023-02-20T16:20:00Z',
    used_by: ['notifyUsers'],
    environment: 'production',
  },
  {
    id: 4,
    name: 'test_api_key',
    description: 'API key for testing purposes',
    created_at: '2023-03-10T13:50:00Z',
    updated_at: '2023-03-10T13:50:00Z',
    used_by: [],
    environment: 'development',
  },
];

const Secrets = () => {
  const [secrets, setSecrets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState(null);
  const [secretToDelete, setSecretToDelete] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    value: '',
    environment: 'production',
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
    isOpen: isViewModalOpen, 
    onOpen: onViewModalOpen, 
    onClose: onViewModalClose 
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

  // Load secrets on component mount
  useEffect(() => {
    fetchSecrets();
  }, []);

  // Fetch secrets from API
  const fetchSecrets = async () => {
    setIsLoading(true);
    
    try {
      // In a real app, use API call
      // const response = await axios.get('/api/v1/secrets');
      // setSecrets(response.data);
      
      // Using mock data for now
      setTimeout(() => {
        setSecrets(mockSecrets);
        setIsLoading(false);
      }, 800);
    } catch (error) {
      console.error('Error fetching secrets:', error);
      toast({
        title: 'Error fetching secrets',
        description: error.message || 'Failed to load secrets',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
    }
  };

  // Handle create secret
  const handleCreateSecret = async () => {
    try {
      // In a real app, use API call
      // const response = await axios.post('/api/v1/secrets', formData);
      // const newSecret = response.data;
      
      // Mock successful creation
      const newSecret = {
        id: secrets.length + 1,
        name: formData.name,
        description: formData.description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        used_by: [],
        environment: formData.environment,
      };
      
      setSecrets([...secrets, newSecret]);
      
      toast({
        title: 'Secret created',
        description: `Secret "${formData.name}" created successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        value: '',
        environment: 'production',
      });
      onCreateModalClose();
    } catch (error) {
      console.error('Error creating secret:', error);
      toast({
        title: 'Error creating secret',
        description: error.message || 'Failed to create secret',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle edit secret
  const handleEditSecret = async () => {
    if (!selectedSecret) return;
    
    try {
      // In a real app, use API call
      // const response = await axios.put(`/api/v1/secrets/${selectedSecret.name}`, formData);
      // const updatedSecret = response.data;
      
      // Mock successful update
      const updatedSecret = {
        ...selectedSecret,
        name: formData.name,
        description: formData.description,
        environment: formData.environment,
        updated_at: new Date().toISOString(),
      };
      
      setSecrets(secrets.map(s => s.id === updatedSecret.id ? updatedSecret : s));
      
      toast({
        title: 'Secret updated',
        description: `Secret "${formData.name}" updated successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset form and close modal
      setSelectedSecret(null);
      onEditModalClose();
    } catch (error) {
      console.error('Error updating secret:', error);
      toast({
        title: 'Error updating secret',
        description: error.message || 'Failed to update secret',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle delete secret
  const handleDeleteSecret = async () => {
    if (!secretToDelete) return;
    
    try {
      // In a real app, use API call
      // await axios.delete(`/api/v1/secrets/${secretToDelete.name}`);
      
      // Update local state
      setSecrets(secrets.filter(s => s.id !== secretToDelete.id));
      
      toast({
        title: 'Secret deleted',
        description: `Secret "${secretToDelete.name}" deleted successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Reset state and close alert
      setSecretToDelete(null);
      onDeleteAlertClose();
    } catch (error) {
      console.error('Error deleting secret:', error);
      toast({
        title: 'Error deleting secret',
        description: error.message || 'Failed to delete secret',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Copy secret value to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: 'Copied to clipboard',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      },
      (err) => {
        console.error('Failed to copy text: ', err);
        toast({
          title: 'Failed to copy',
          description: 'Could not copy to clipboard',
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
      }
    );
  };

  // Open edit modal and set selected secret
  const openEditModal = (secret) => {
    setSelectedSecret(secret);
    setFormData({
      name: secret.name,
      description: secret.description,
      value: '', // Don't prefill value for security
      environment: secret.environment,
    });
    onEditModalOpen();
  };

  // Open view modal and set selected secret
  const openViewModal = (secret) => {
    setSelectedSecret(secret);
    setShowSecret(false);
    onViewModalOpen();
  };

  // Open delete alert and set secret to delete
  const openDeleteAlert = (secret) => {
    setSecretToDelete(secret);
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
        <Heading size="lg">Secrets</Heading>
        <Button 
          leftIcon={<FiPlus />} 
          colorScheme="brand" 
          onClick={onCreateModalOpen}
        >
          Create Secret
        </Button>
      </Flex>

      {/* Security notice */}
      <Box
        bg={useColorModeValue('orange.50', 'orange.900')}
        color={useColorModeValue('orange.800', 'orange.200')}
        p={4}
        borderRadius="md"
        mb={6}
        display="flex"
        alignItems="center"
      >
        <Box as={FiAlertTriangle} size="24px" mr={3} />
        <Box>
          <Text fontWeight="bold">Security Notice</Text>
          <Text fontSize="sm">
            Secrets are stored securely in the TEE environment and are only accessible within the TEE.
            Secret values are never exposed outside the secure environment.
          </Text>
        </Box>
      </Box>

      {/* Secrets table */}
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
        ) : secrets.length === 0 ? (
          <Flex direction="column" align="center" justify="center" p={8} textAlign="center">
            <Text fontSize="lg" mb={4}>No secrets found</Text>
            <Button 
              leftIcon={<FiPlus />} 
              colorScheme="brand" 
              onClick={onCreateModalOpen}
            >
              Create your first secret
            </Button>
          </Flex>
        ) : (
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Environment</Th>
                <Th>Last Updated</Th>
                <Th>Used By</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {secrets.map((secret) => (
                <Tr key={secret.id}>
                  <Td fontWeight="medium">{secret.name}</Td>
                  <Td>{secret.description}</Td>
                  <Td>
                    <Badge 
                      colorScheme={secret.environment === 'production' ? 'green' : 'purple'}
                      borderRadius="full"
                      px={2}
                    >
                      {secret.environment}
                    </Badge>
                  </Td>
                  <Td>{formatDate(secret.updated_at)}</Td>
                  <Td>
                    {secret.used_by.length > 0 ? (
                      <Flex wrap="wrap" gap={1}>
                        {secret.used_by.map((func, idx) => (
                          <Badge key={idx} colorScheme="blue" variant="outline">
                            {func}
                          </Badge>
                        ))}
                      </Flex>
                    ) : (
                      <Text fontSize="sm" color="gray.500">Not used</Text>
                    )}
                  </Td>
                  <Td>
                    <Flex>
                      <Tooltip label="View secret details" placement="top">
                        <IconButton
                          icon={<FiEye />}
                          aria-label="View secret"
                          size="sm"
                          colorScheme="brand"
                          variant="ghost"
                          mr={2}
                          onClick={() => openViewModal(secret)}
                        />
                      </Tooltip>
                      <Menu>
                        <MenuButton
                          as={IconButton}
                          icon={<FiMoreVertical />}
                          variant="ghost"
                          size="sm"
                          aria-label="More options"
                        />
                        <MenuList>
                          <MenuItem icon={<FiEdit />} onClick={() => openEditModal(secret)}>
                            Edit
                          </MenuItem>
                          <MenuItem icon={<FiTrash2 />} color="red.500" onClick={() => openDeleteAlert(secret)}>
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

      {/* Create Secret Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={onCreateModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Secret</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Secret Name</FormLabel>
                <Input 
                  placeholder="Enter secret name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Use lowercase letters, numbers, and underscores only (e.g., api_key_name)
                </Text>
              </FormControl>
              
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea 
                  placeholder="Enter secret description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Secret Value</FormLabel>
                <InputGroup>
                  <Input 
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter secret value"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                  />
                  <InputRightElement>
                    <IconButton
                      icon={showSecret ? <FiEyeOff /> : <FiEye />}
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowSecret(!showSecret)}
                      aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                    />
                  </InputRightElement>
                </InputGroup>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Secret values are securely stored in the TEE and never exposed outside that environment
                </Text>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Environment</FormLabel>
                <Select 
                  value={formData.environment}
                  onChange={(e) => setFormData({...formData, environment: e.target.value})}
                >
                  <option value="production">Production</option>
                  <option value="development">Development</option>
                  <option value="testing">Testing</option>
                </Select>
              </FormControl>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="brand" 
              onClick={handleCreateSecret}
              isDisabled={!formData.name || !formData.value}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Secret Modal */}
      <Modal isOpen={isEditModalOpen} onClose={onEditModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Secret: {selectedSecret?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Secret Name</FormLabel>
                <Input 
                  placeholder="Enter secret name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Use lowercase letters, numbers, and underscores only (e.g., api_key_name)
                </Text>
              </FormControl>
              
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea 
                  placeholder="Enter secret description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Secret Value</FormLabel>
                <InputGroup>
                  <Input 
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Enter new secret value (leave empty to keep current)"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                  />
                  <InputRightElement>
                    <IconButton
                      icon={showSecret ? <FiEyeOff /> : <FiEye />}
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowSecret(!showSecret)}
                      aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                    />
                  </InputRightElement>
                </InputGroup>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Leave blank to keep the current value. For security reasons, current values cannot be viewed.
                </Text>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Environment</FormLabel>
                <Select 
                  value={formData.environment}
                  onChange={(e) => setFormData({...formData, environment: e.target.value})}
                >
                  <option value="production">Production</option>
                  <option value="development">Development</option>
                  <option value="testing">Testing</option>
                </Select>
              </FormControl>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditModalClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="brand" 
              onClick={handleEditSecret}
              isDisabled={!formData.name}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* View Secret Modal */}
      <Modal isOpen={isViewModalOpen} onClose={onViewModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Secret Details: {selectedSecret?.name}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
                <Text fontWeight="bold" mb={1}>Name:</Text>
                <Flex align="center">
                  <Text fontFamily="monospace">{selectedSecret?.name}</Text>
                  <IconButton
                    icon={<FiCopy />}
                    aria-label="Copy secret name"
                    size="xs"
                    ml={2}
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedSecret?.name)}
                  />
                </Flex>
              </Box>
              
              <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
                <Text fontWeight="bold" mb={1}>Description:</Text>
                <Text>{selectedSecret?.description || 'No description provided'}</Text>
              </Box>
              
              <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
                <Text fontWeight="bold" mb={1}>Environment:</Text>
                <Badge 
                  colorScheme={selectedSecret?.environment === 'production' ? 'green' : 'purple'}
                  borderRadius="full"
                  px={2}
                >
                  {selectedSecret?.environment}
                </Badge>
              </Box>
              
              <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
                <Text fontWeight="bold" mb={1}>Created:</Text>
                <Text>{formatDate(selectedSecret?.created_at)}</Text>
              </Box>
              
              <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
                <Text fontWeight="bold" mb={1}>Last Updated:</Text>
                <Text>{formatDate(selectedSecret?.updated_at)}</Text>
              </Box>
              
              <Box p={4} borderWidth="1px" borderRadius="md" borderColor={borderColor}>
                <Text fontWeight="bold" mb={1}>Used By:</Text>
                {selectedSecret?.used_by.length > 0 ? (
                  <Flex wrap="wrap" gap={2} mt={2}>
                    {selectedSecret.used_by.map((func, idx) => (
                      <Badge key={idx} colorScheme="blue" p={1}>
                        {func}
                      </Badge>
                    ))}
                  </Flex>
                ) : (
                  <Text color="gray.500">Not used by any functions</Text>
                )}
              </Box>
              
              <Box 
                p={4} 
                borderWidth="1px" 
                borderRadius="md" 
                borderColor={borderColor} 
                bg={useColorModeValue('gray.50', 'gray.700')}
              >
                <Text fontWeight="bold" mb={1}>Secret Value:</Text>
                <Text fontSize="sm" color="gray.500">
                  For security reasons, secret values cannot be viewed. Secret values are only accessible within the TEE environment.
                </Text>
              </Box>
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button mr={3} onClick={() => openEditModal(selectedSecret)}>
              Edit
            </Button>
            <Button colorScheme="brand" onClick={onViewModalClose}>
              Close
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
              Delete Secret
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete the secret "{secretToDelete?.name}"? 
              {secretToDelete?.used_by.length > 0 && (
                <Text color="red.500" mt={2}>
                  Warning: This secret is used by {secretToDelete.used_by.length} function(s). 
                  Deleting it may cause those functions to fail.
                </Text>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteAlertClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteSecret} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default Secrets; 
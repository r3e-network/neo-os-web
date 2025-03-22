import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Divider,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Avatar,
  InputGroup,
  InputRightElement,
  Badge,
  IconButton,
  Alert,
  AlertIcon,
  AlertDescription,
  useToast,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Spinner,
  useColorModeValue,
  Tooltip,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Code,
} from '@chakra-ui/react';
import {
  FiUser,
  FiKey,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiRefreshCw,
  FiUnlock,
  FiLock,
  FiClipboard,
  FiCheck,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';

const Profile = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyExpiry, setApiKeyExpiry] = useState('30d');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [formCopied, setFormCopied] = useState(false);
  
  // Form states
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const toast = useToast();
  const {
    isOpen: isCreateKeyModalOpen,
    onOpen: onCreateKeyModalOpen,
    onClose: onCreateKeyModalClose,
  } = useDisclosure();
  
  const {
    isOpen: isNewKeyModalOpen,
    onOpen: onNewKeyModalOpen,
    onClose: onNewKeyModalClose,
  } = useDisclosure();
  
  const {
    isOpen: isDeleteKeyModalOpen,
    onOpen: onDeleteKeyModalOpen,
    onClose: onDeleteKeyModalClose,
  } = useDisclosure();
  
  const [selectedKeyId, setSelectedKeyId] = useState(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Load user profile data
  useEffect(() => {
    if (!authLoading && user) {
      loadUserData();
    }
  }, [authLoading, user]);
  
  const loadUserData = async () => {
    setLoading(true);
    
    try {
      // Load user profile and API keys in parallel
      const [profileResponse, keysResponse] = await Promise.all([
        userService.getCurrentUser(),
        userService.getApiKeys(),
      ]);
      
      setUserProfile(profileResponse);
      setApiKeys(keysResponse.keys || []);
      
      // Initialize form with current user data
      setProfileForm({
        name: profileResponse.name || '',
        email: profileResponse.email || '',
      });
    } catch (err) {
      console.error('Failed to load user data:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to load your profile data.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle profile form change
  const handleProfileFormChange = (e) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle password form change
  const handlePasswordFormChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };
  
  // Update profile
  const handleUpdateProfile = async () => {
    setLoading(true);
    
    try {
      await userService.updateProfile(profileForm);
      
      toast({
        title: 'Success',
        description: 'Your profile has been updated.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reload user data
      await loadUserData();
    } catch (err) {
      console.error('Failed to update profile:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to update your profile.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Change password
  const handleChangePassword = async () => {
    // Validate password form
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New password and confirmation do not match.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    setLoading(true);
    
    try {
      await userService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      
      toast({
        title: 'Success',
        description: 'Your password has been changed.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reset password form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Failed to change password:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to change your password.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Create API key
  const handleCreateApiKey = async () => {
    if (!apiKeyName.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a name for the API key.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await userService.createApiKey(apiKeyName, apiKeyExpiry);
      
      // Close create modal and open the new key modal
      onCreateKeyModalClose();
      setNewApiKey(response);
      onNewKeyModalOpen();
      
      // Reset form
      setApiKeyName('');
      setApiKeyExpiry('30d');
      
      // Reload API keys
      await loadUserData();
    } catch (err) {
      console.error('Failed to create API key:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to create API key.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Delete API key
  const handleDeleteApiKey = async () => {
    if (!selectedKeyId) return;
    
    setLoading(true);
    
    try {
      await userService.deleteApiKey(selectedKeyId);
      
      toast({
        title: 'Success',
        description: 'API key deleted successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reload API keys and close modal
      await loadUserData();
      onDeleteKeyModalClose();
    } catch (err) {
      console.error('Failed to delete API key:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete API key.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Copy API key to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setFormCopied(true);
    
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
    
    setTimeout(() => setFormCopied(false), 2000);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <Box>
      <Heading size="lg" mb={6}>My Profile</Heading>
      
      {(loading || authLoading) && !userProfile ? (
        <Flex justify="center" align="center" p={8}>
          <Spinner size="xl" />
        </Flex>
      ) : (
        <Tabs variant="enclosed" colorScheme="blue">
          <TabList>
            <Tab><HStack><FiUser /><Text>Profile</Text></HStack></Tab>
            <Tab><HStack><FiKey /><Text>API Keys</Text></HStack></Tab>
          </TabList>
          
          <TabPanels>
            {/* Profile Tab */}
            <TabPanel>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                {/* Profile Information */}
                <Card bg={bgColor} borderColor={borderColor} borderWidth="1px" boxShadow="sm">
                  <CardHeader>
                    <Heading size="md">Profile Information</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="start">
                      <FormControl>
                        <FormLabel>Name</FormLabel>
                        <Input
                          name="name"
                          value={profileForm.name}
                          onChange={handleProfileFormChange}
                          placeholder="Your name"
                        />
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Email</FormLabel>
                        <Input
                          name="email"
                          type="email"
                          value={profileForm.email}
                          onChange={handleProfileFormChange}
                          placeholder="Your email"
                          isReadOnly
                        />
                      </FormControl>
                    </VStack>
                  </CardBody>
                  <CardFooter>
                    <Button
                      colorScheme="blue"
                      onClick={handleUpdateProfile}
                      isLoading={loading}
                    >
                      Update Profile
                    </Button>
                  </CardFooter>
                </Card>
                
                {/* Change Password */}
                <Card bg={bgColor} borderColor={borderColor} borderWidth="1px" boxShadow="sm">
                  <CardHeader>
                    <Heading size="md">Change Password</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack spacing={4} align="start">
                      <FormControl>
                        <FormLabel>Current Password</FormLabel>
                        <InputGroup>
                          <Input
                            name="currentPassword"
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={handlePasswordFormChange}
                            placeholder="Current password"
                          />
                          <InputRightElement>
                            <IconButton
                              icon={showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            />
                          </InputRightElement>
                        </InputGroup>
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>New Password</FormLabel>
                        <InputGroup>
                          <Input
                            name="newPassword"
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={handlePasswordFormChange}
                            placeholder="New password"
                          />
                          <InputRightElement>
                            <IconButton
                              icon={showPassword ? <FiEyeOff /> : <FiEye />}
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowPassword(!showPassword)}
                            />
                          </InputRightElement>
                        </InputGroup>
                      </FormControl>
                      
                      <FormControl>
                        <FormLabel>Confirm New Password</FormLabel>
                        <Input
                          name="confirmPassword"
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={handlePasswordFormChange}
                          placeholder="Confirm new password"
                        />
                      </FormControl>
                    </VStack>
                  </CardBody>
                  <CardFooter>
                    <Button
                      colorScheme="blue"
                      onClick={handleChangePassword}
                      isLoading={loading}
                    >
                      Change Password
                    </Button>
                  </CardFooter>
                </Card>
              </SimpleGrid>
            </TabPanel>
            
            {/* API Keys Tab */}
            <TabPanel>
              <Card bg={bgColor} borderColor={borderColor} borderWidth="1px" boxShadow="sm">
                <CardHeader>
                  <Flex justify="space-between" align="center">
                    <Heading size="md">API Keys</Heading>
                    <Button
                      leftIcon={<FiPlus />}
                      colorScheme="blue"
                      onClick={onCreateKeyModalOpen}
                      isLoading={loading}
                    >
                      Create API Key
                    </Button>
                  </Flex>
                </CardHeader>
                <CardBody>
                  {loading && !apiKeys.length ? (
                    <Flex justify="center" align="center" p={4}>
                      <Spinner size="lg" />
                    </Flex>
                  ) : apiKeys.length === 0 ? (
                    <Alert status="info">
                      <AlertIcon />
                      <AlertDescription>You don't have any API keys yet. Create one to use the API.</AlertDescription>
                    </Alert>
                  ) : (
                    <Box overflowX="auto">
                      <Table variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Name</Th>
                            <Th>Created</Th>
                            <Th>Expires</Th>
                            <Th>Last Used</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {apiKeys.map((key) => (
                            <Tr key={key.id}>
                              <Td>{key.name}</Td>
                              <Td>{formatDate(key.createdAt)}</Td>
                              <Td>
                                {key.expiresAt ? (
                                  <Text>{formatDate(key.expiresAt)}</Text>
                                ) : (
                                  <Badge colorScheme="green">Never</Badge>
                                )}
                              </Td>
                              <Td>{key.lastUsed ? formatDate(key.lastUsed) : 'Never'}</Td>
                              <Td>
                                <IconButton
                                  icon={<FiTrash2 />}
                                  colorScheme="red"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedKeyId(key.id);
                                    onDeleteKeyModalOpen();
                                  }}
                                  aria-label="Delete API key"
                                />
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  )}
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
      
      {/* Create API Key Modal */}
      <Modal isOpen={isCreateKeyModalOpen} onClose={onCreateKeyModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create API Key</ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            <VStack spacing={4} align="start">
              <FormControl isRequired>
                <FormLabel>Key Name</FormLabel>
                <Input
                  placeholder="Enter a name for your API key"
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Expiration</FormLabel>
                <Select
                  value={apiKeyExpiry}
                  onChange={(e) => setApiKeyExpiry(e.target.value)}
                >
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="90d">90 Days</option>
                  <option value="180d">180 Days</option>
                  <option value="365d">365 Days</option>
                  <option value="never">Never</option>
                </Select>
              </FormControl>
              
              <Alert status="warning">
                <AlertIcon />
                <AlertDescription>
                  You will only be able to view the API key once after creation. Make sure to store it securely.
                </AlertDescription>
              </Alert>
            </VStack>
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleCreateApiKey} isLoading={loading}>
              Create
            </Button>
            <Button onClick={onCreateKeyModalClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* New API Key Modal */}
      <Modal
        isOpen={isNewKeyModalOpen}
        onClose={onNewKeyModalClose}
        closeOnOverlayClick={false}
        closeOnEsc={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Your New API Key</ModalHeader>
          
          <ModalBody pb={6}>
            <Alert status="warning" mb={4}>
              <AlertIcon />
              <AlertDescription>
                This is the only time you'll see this API key. Please copy it now and store it securely.
              </AlertDescription>
            </Alert>
            
            <VStack spacing={4} align="start">
              <FormControl>
                <FormLabel>API Key</FormLabel>
                <InputGroup>
                  <Input
                    value={newApiKey?.key || ''}
                    isReadOnly
                    fontFamily="monospace"
                    fontSize="sm"
                  />
                  <InputRightElement>
                    <IconButton
                      icon={formCopied ? <FiCheck /> : <FiCopy />}
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(newApiKey?.key || '')}
                      color={formCopied ? 'green.500' : undefined}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              
              <Box width="100%" p={3} borderWidth="1px" borderRadius="md" bg="gray.50" fontSize="sm">
                <Text fontWeight="bold" mb={2}>Example usage:</Text>
                <Code p={2} borderRadius="md" display="block" whiteSpace="pre" overflowX="auto">
{`curl -X GET https://api.service.io/v1/function \\
  -H "Authorization: Bearer ${newApiKey?.key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json"`}
                </Code>
              </Box>
            </VStack>
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="blue" onClick={onNewKeyModalClose}>
              I've Saved My API Key
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete API Key Confirmation Modal */}
      <Modal isOpen={isDeleteKeyModalOpen} onClose={onDeleteKeyModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete API Key</ModalHeader>
          <ModalCloseButton />
          
          <ModalBody>
            <Text>
              Are you sure you want to delete this API key? This action cannot be undone, and any applications using this key will no longer be able to access the API.
            </Text>
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={handleDeleteApiKey} isLoading={loading}>
              Delete
            </Button>
            <Button onClick={onDeleteKeyModalClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Profile; 
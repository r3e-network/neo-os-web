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
  useDisclosure,
  useToast,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Input,
  InputGroup,
  InputLeftElement,
  FormControl,
  FormLabel,
  Select,
  Stack,
  Switch,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiSearch,
  FiKey,
  FiLock,
  FiMoreVertical,
  FiUser,
  FiUsers,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
} from 'react-icons/fi';
import userService from '../services/userService';
import { useAuth } from '../context/AuthContext';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Modal states
  const {
    isOpen: isUserModalOpen,
    onOpen: onUserModalOpen,
    onClose: onUserModalClose,
  } = useDisclosure();
  
  const {
    isOpen: isRoleModalOpen,
    onOpen: onRoleModalOpen,
    onClose: onRoleModalClose,
  } = useDisclosure();
  
  const {
    isOpen: isPermissionModalOpen,
    onOpen: onPermissionModalOpen,
    onClose: onPermissionModalClose,
  } = useDisclosure();
  
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();

  // Form states
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    active: true,
    roles: [],
  });
  
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: [],
  });
  
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  
  // Load initial data
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load users and roles in parallel
      const [usersResponse, rolesResponse] = await Promise.all([
        userService.getUsers(),
        userService.getRoles(),
      ]);
      
      setUsers(usersResponse.users || []);
      setRoles(rolesResponse.roles || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load users and roles. Please try again.');
      
      toast({
        title: 'Error',
        description: 'Failed to load users and roles.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // User operations
  const handleOpenUserModal = (user = null) => {
    if (user) {
      // Edit mode
      setUserForm({
        name: user.name,
        email: user.email,
        password: '',
        active: user.active,
        roles: user.roles.map(role => role.id),
      });
      setSelectedUser(user);
    } else {
      // Create mode
      setUserForm({
        name: '',
        email: '',
        password: '',
        active: true,
        roles: [],
      });
      setSelectedUser(null);
    }
    
    onUserModalOpen();
  };
  
  const handleUserFormChange = (e) => {
    const { name, value, checked } = e.target;
    
    if (name === 'active') {
      setUserForm(prev => ({ ...prev, [name]: checked }));
    } else {
      setUserForm(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleRoleSelection = (roleId) => {
    setUserForm(prev => {
      const currentRoles = [...prev.roles];
      
      if (currentRoles.includes(roleId)) {
        return { ...prev, roles: currentRoles.filter(id => id !== roleId) };
      } else {
        return { ...prev, roles: [...currentRoles, roleId] };
      }
    });
  };
  
  const handleSubmitUser = async () => {
    try {
      if (selectedUser) {
        // Update existing user
        await userService.updateUser(selectedUser.id, userForm);
        
        toast({
          title: 'Success',
          description: 'User updated successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Create new user
        await userService.createUser(userForm);
        
        toast({
          title: 'Success',
          description: 'User created successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Reload data and close modal
      await loadData();
      onUserModalClose();
    } catch (err) {
      console.error('Failed to save user:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to save user.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await userService.deleteUser(selectedUser.id);
      
      toast({
        title: 'Success',
        description: 'User deleted successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reload data and close modal
      await loadData();
      onDeleteModalClose();
    } catch (err) {
      console.error('Failed to delete user:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete user.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Role operations
  const handleOpenRoleModal = (role = null) => {
    if (role) {
      // Edit mode
      setRoleForm({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions || [],
      });
      setSelectedRole(role);
    } else {
      // Create mode
      setRoleForm({
        name: '',
        description: '',
        permissions: [],
      });
      setSelectedRole(null);
    }
    
    onRoleModalOpen();
  };
  
  const handleRoleFormChange = (e) => {
    const { name, value } = e.target;
    setRoleForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmitRole = async () => {
    try {
      if (selectedRole) {
        // Update existing role
        await userService.updateRole(selectedRole.id, roleForm);
        
        toast({
          title: 'Success',
          description: 'Role updated successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Create new role
        await userService.createRole(roleForm);
        
        toast({
          title: 'Success',
          description: 'Role created successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      // Reload data and close modal
      await loadData();
      onRoleModalClose();
    } catch (err) {
      console.error('Failed to save role:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to save role.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    
    try {
      await userService.deleteRole(selectedRole.id);
      
      toast({
        title: 'Success',
        description: 'Role deleted successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reload data and close modal
      await loadData();
      onDeleteModalClose();
    } catch (err) {
      console.error('Failed to delete role:', err);
      
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete role.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Permission operations
  const handleOpenPermissionModal = async (role) => {
    setSelectedRole(role);
    setLoading(true);
    
    try {
      // Load all available permissions and the role's current permissions
      const [allPermissions, rolePermissions] = await Promise.all([
        // This would fetch all possible permissions in the system
        userService.getServicePermissions('all'),
        userService.getRolePermissions(role.id),
      ]);
      
      setAvailablePermissions(allPermissions.permissions || []);
      setSelectedPermissions(rolePermissions.permissions || []);
      onPermissionModalOpen();
    } catch (err) {
      console.error('Failed to load permissions:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to load permission data.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleTogglePermission = (permissionId) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };
  
  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    
    try {
      await userService.updateRolePermissions(selectedRole.id, selectedPermissions);
      
      toast({
        title: 'Success',
        description: 'Permissions updated successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Reload data and close modal
      await loadData();
      onPermissionModalClose();
    } catch (err) {
      console.error('Failed to update permissions:', err);
      
      toast({
        title: 'Error',
        description: 'Failed to update permissions.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Filter users based on search query
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <Box>
      <Heading size="lg" mb={6}>User Management</Heading>
      
      <Tabs 
        index={tabIndex}
        onChange={index => setTabIndex(index)}
        colorScheme="blue"
        variant="enclosed"
        mb={6}
      >
        <TabList>
          <Tab><HStack><FiUser /><Text>Users</Text></HStack></Tab>
          <Tab><HStack><FiUsers /><Text>Roles</Text></HStack></Tab>
        </TabList>
        
        <TabPanels mt={4}>
          {/* Users Tab */}
          <TabPanel p={0}>
            <Box
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg={bgColor}
              mb={6}
            >
              <Flex p={4} justify="space-between" align="center" borderBottomWidth="1px">
                <InputGroup maxW="md">
                  <InputLeftElement>
                    <FiSearch color="gray.300" />
                  </InputLeftElement>
                  <Input 
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </InputGroup>
                
                <Button
                  leftIcon={<FiPlus />}
                  colorScheme="blue"
                  onClick={() => handleOpenUserModal()}
                >
                  Add User
                </Button>
              </Flex>
              
              {loading ? (
                <Flex justify="center" align="center" p={8}>
                  <Spinner size="lg" />
                </Flex>
              ) : error ? (
                <Alert status="error" borderRadius={0}>
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : filteredUsers.length === 0 ? (
                <Box p={8} textAlign="center">
                  <Text color="gray.500">No users found</Text>
                </Box>
              ) : (
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Name</Th>
                        <Th>Email</Th>
                        <Th>Status</Th>
                        <Th>Roles</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filteredUsers.map(user => (
                        <Tr key={user.id}>
                          <Td>{user.name}</Td>
                          <Td>{user.email}</Td>
                          <Td>
                            {user.active ? (
                              <Badge colorScheme="green">Active</Badge>
                            ) : (
                              <Badge colorScheme="red">Inactive</Badge>
                            )}
                          </Td>
                          <Td>
                            <HStack spacing={2} flexWrap="wrap">
                              {user.roles.map(role => (
                                <Badge key={role.id} colorScheme="blue">
                                  {role.name}
                                </Badge>
                              ))}
                              {user.roles.length === 0 && (
                                <Text fontSize="sm" color="gray.500">No roles assigned</Text>
                              )}
                            </HStack>
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
                                <MenuItem 
                                  icon={<FiEdit />}
                                  onClick={() => handleOpenUserModal(user)}
                                >
                                  Edit
                                </MenuItem>
                                <MenuItem 
                                  icon={<FiKey />}
                                  onClick={() => {
                                    setSelectedUser(user);
                                    // Handle reset password
                                  }}
                                >
                                  Reset Password
                                </MenuItem>
                                <MenuItem 
                                  icon={<FiTrash2 />}
                                  color="red.500"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    onDeleteModalOpen();
                                  }}
                                >
                                  Delete
                                </MenuItem>
                              </MenuList>
                            </Menu>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </Box>
          </TabPanel>
          
          {/* Roles Tab */}
          <TabPanel p={0}>
            <Box
              borderWidth="1px"
              borderRadius="lg"
              overflow="hidden"
              bg={bgColor}
              mb={6}
            >
              <Flex p={4} justify="space-between" align="center" borderBottomWidth="1px">
                <Heading size="md">Roles and Permissions</Heading>
                
                <Button
                  leftIcon={<FiPlus />}
                  colorScheme="blue"
                  onClick={() => handleOpenRoleModal()}
                >
                  Add Role
                </Button>
              </Flex>
              
              {loading ? (
                <Flex justify="center" align="center" p={8}>
                  <Spinner size="lg" />
                </Flex>
              ) : error ? (
                <Alert status="error" borderRadius={0}>
                  <AlertIcon />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : roles.length === 0 ? (
                <Box p={8} textAlign="center">
                  <Text color="gray.500">No roles found</Text>
                </Box>
              ) : (
                <Box overflowX="auto">
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Name</Th>
                        <Th>Description</Th>
                        <Th>Users</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {roles.map(role => (
                        <Tr key={role.id}>
                          <Td>{role.name}</Td>
                          <Td>{role.description || '-'}</Td>
                          <Td>
                            {role.userCount || 0}
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <Tooltip label="Edit Role">
                                <IconButton
                                  icon={<FiEdit />}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenRoleModal(role)}
                                />
                              </Tooltip>
                              <Tooltip label="Manage Permissions">
                                <IconButton
                                  icon={<FiLock />}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenPermissionModal(role)}
                                />
                              </Tooltip>
                              <Tooltip label="Delete Role">
                                <IconButton
                                  icon={<FiTrash2 />}
                                  variant="ghost"
                                  size="sm"
                                  colorScheme="red"
                                  onClick={() => {
                                    setSelectedRole(role);
                                    onDeleteModalOpen();
                                  }}
                                />
                              </Tooltip>
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
      
      {/* User Modal */}
      <Modal isOpen={isUserModalOpen} onClose={onUserModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedUser ? 'Edit User' : 'Create New User'}
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  name="name"
                  value={userForm.name}
                  onChange={handleUserFormChange}
                  placeholder="Enter user's name"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  value={userForm.email}
                  onChange={handleUserFormChange}
                  placeholder="Enter user's email"
                />
              </FormControl>
              
              {!selectedUser && (
                <FormControl>
                  <FormLabel>Password</FormLabel>
                  <Input
                    name="password"
                    type="password"
                    value={userForm.password}
                    onChange={handleUserFormChange}
                    placeholder="Enter password"
                  />
                </FormControl>
              )}
              
              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>Active</FormLabel>
                <Switch
                  name="active"
                  isChecked={userForm.active}
                  onChange={handleUserFormChange}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Roles</FormLabel>
                <Stack spacing={2} maxH="200px" overflow="auto" p={2} borderWidth="1px" borderRadius="md">
                  {roles.map(role => (
                    <Flex key={role.id} align="center">
                      <Switch
                        isChecked={userForm.roles.includes(role.id)}
                        onChange={() => handleRoleSelection(role.id)}
                        mr={3}
                      />
                      <Text>{role.name}</Text>
                    </Flex>
                  ))}
                </Stack>
              </FormControl>
            </Stack>
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleSubmitUser}>
              Save
            </Button>
            <Button onClick={onUserModalClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Role Modal */}
      <Modal isOpen={isRoleModalOpen} onClose={onRoleModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedRole ? 'Edit Role' : 'Create New Role'}
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  name="name"
                  value={roleForm.name}
                  onChange={handleRoleFormChange}
                  placeholder="Enter role name"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Input
                  name="description"
                  value={roleForm.description}
                  onChange={handleRoleFormChange}
                  placeholder="Enter role description"
                />
              </FormControl>
            </Stack>
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleSubmitRole}>
              Save
            </Button>
            <Button onClick={onRoleModalClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Permissions Modal */}
      <Modal isOpen={isPermissionModalOpen} onClose={onPermissionModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Manage Permissions for {selectedRole?.name}
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            {loading ? (
              <Flex justify="center" align="center" p={8}>
                <Spinner size="lg" />
              </Flex>
            ) : (
              <Stack spacing={4} maxH="400px" overflow="auto">
                {availablePermissions.length === 0 ? (
                  <Text>No permissions available</Text>
                ) : (
                  availablePermissions.map(permission => (
                    <Flex key={permission.id} justify="space-between" align="center">
                      <Box>
                        <Text fontWeight="medium">{permission.name}</Text>
                        <Text fontSize="sm" color="gray.500">{permission.description}</Text>
                      </Box>
                      <Switch
                        isChecked={selectedPermissions.includes(permission.id)}
                        onChange={() => handleTogglePermission(permission.id)}
                      />
                    </Flex>
                  ))
                )}
              </Stack>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleSavePermissions}>
              Save
            </Button>
            <Button onClick={onPermissionModalClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalCloseButton />
          
          <ModalBody>
            {tabIndex === 0 ? (
              <Text>
                Are you sure you want to delete the user <strong>{selectedUser?.name}</strong>?
                This action cannot be undone.
              </Text>
            ) : (
              <Text>
                Are you sure you want to delete the role <strong>{selectedRole?.name}</strong>?
                This will remove the role from all users, and cannot be undone.
              </Text>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button colorScheme="red" mr={3} onClick={tabIndex === 0 ? handleDeleteUser : handleDeleteRole}>
              Delete
            </Button>
            <Button onClick={onDeleteModalClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Users; 
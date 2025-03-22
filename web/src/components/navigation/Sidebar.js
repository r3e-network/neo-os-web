import React from 'react';
import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  Flex,
  VStack,
  IconButton,
  Text,
  CloseButton,
  useColorModeValue,
  Link,
  Icon,
  Divider,
} from '@chakra-ui/react';
import {
  FiHome,
  FiCode,
  FiKey,
  FiClock,
  FiDollarSign,
  FiShield,
  FiDatabase,
  FiServer,
  FiUser,
  FiUsers,
  FiSettings,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

// Array of navigation items
const navItems = [
  { name: 'Dashboard', path: '/', icon: FiHome },
  { name: 'Functions', path: '/functions', icon: FiCode },
  { name: 'Secrets', path: '/secrets', icon: FiKey },
  { name: 'Automation', path: '/automation', icon: FiClock },
  { name: 'Price Feed', path: '/price-feed', icon: FiDollarSign },
  { name: 'Random', path: '/random', icon: FiShield },
  { name: 'Oracle', path: '/oracle', icon: FiDatabase },
  { name: 'Gas Bank', path: '/gas-bank', icon: FiServer },
];

// Admin navigation items
const adminNavItems = [
  { name: 'Users', path: '/users', icon: FiUsers, requiredRole: 'admin' },
];

// User profile navigation items
const userNavItems = [
  { name: 'My Profile', path: '/profile', icon: FiUser },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Check if user is admin
  const isAdmin = user?.roles?.some(role => role.name === 'admin');
  
  // Filter admin nav items based on user roles
  const filteredAdminNavItems = adminNavItems.filter(item => {
    if (!item.requiredRole) return true;
    return isAdmin;
  });
  
  return (
    <Box
      transition="0.3s ease"
      bg={bgColor}
      borderRight="1px"
      borderRightColor={borderColor}
      w={{ base: 'full', md: isOpen ? '240px' : '80px' }}
      pos="fixed"
      h="full"
      overflow="auto"
      display={{ base: isOpen ? 'block' : 'none', md: 'block' }}
      zIndex="sticky"
    >
      <Flex h="20" alignItems="center" justifyContent="space-between" px={6}>
        <Text
          fontSize="2xl"
          fontFamily="monospace"
          fontWeight="bold"
          color="brand.500"
          display={{ base: 'flex', md: isOpen ? 'flex' : 'none' }}
        >
          Neo N3
        </Text>
        <CloseButton display={{ base: 'flex', md: 'none' }} onClick={onClose} />
      </Flex>
      
      <VStack spacing={1} align="stretch" mt={4}>
        {/* Service Navigation */}
        {navItems.map((item) => (
          <NavItem
            key={item.name}
            icon={item.icon}
            path={item.path}
            isActive={location.pathname === item.path}
            isExpanded={isOpen}
          >
            {item.name}
          </NavItem>
        ))}
        
        {/* Admin Navigation */}
        {filteredAdminNavItems.length > 0 && (
          <>
            <Divider my={2} borderColor={borderColor} />
            {isExpanded && (
              <Text px={6} py={2} fontSize="xs" color="gray.500" fontWeight="bold">
                ADMIN
              </Text>
            )}
            
            {filteredAdminNavItems.map((item) => (
              <NavItem
                key={item.name}
                icon={item.icon}
                path={item.path}
                isActive={location.pathname === item.path}
                isExpanded={isOpen}
              >
                {item.name}
              </NavItem>
            ))}
          </>
        )}
        
        {/* User Navigation */}
        <Divider my={2} borderColor={borderColor} />
        {isExpanded && (
          <Text px={6} py={2} fontSize="xs" color="gray.500" fontWeight="bold">
            USER
          </Text>
        )}
        
        {userNavItems.map((item) => (
          <NavItem
            key={item.name}
            icon={item.icon}
            path={item.path}
            isActive={location.pathname === item.path}
            isExpanded={isOpen}
          >
            {item.name}
          </NavItem>
        ))}
      </VStack>
    </Box>
  );
};

// Individual navigation item component
const NavItem = ({ icon, children, path, isActive, isExpanded, ...rest }) => {
  const activeBg = useColorModeValue('brand.50', 'brand.900');
  const activeColor = useColorModeValue('brand.700', 'brand.200');
  const inactiveColor = useColorModeValue('gray.600', 'gray.300');
  
  return (
    <Link
      as={RouterLink}
      to={path}
      style={{ textDecoration: 'none' }}
      _focus={{ boxShadow: 'none' }}
    >
      <Flex
        align="center"
        p="4"
        mx={{ md: isExpanded ? 2 : 0 }}
        borderRadius={{ md: isExpanded ? 'lg' : 'xl' }}
        role="group"
        cursor="pointer"
        bg={isActive ? activeBg : 'transparent'}
        color={isActive ? activeColor : inactiveColor}
        _hover={{
          bg: activeBg,
          color: activeColor,
        }}
        {...rest}
      >
        <Icon
          mr={isExpanded ? 4 : 0}
          fontSize="16"
          as={icon}
          w={5}
          h={5}
        />
        {isExpanded && <Text>{children}</Text>}
      </Flex>
    </Link>
  );
};

export default Sidebar; 
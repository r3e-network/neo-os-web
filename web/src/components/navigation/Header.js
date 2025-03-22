import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flex,
  IconButton,
  Button,
  Avatar,
  Text,
  HStack,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  useColorMode,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  FiMenu,
  FiSun,
  FiMoon,
  FiUser,
  FiLogOut,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import NotificationCenter from '../notifications/NotificationCenter';

const Header = ({ onOpenSidebar }) => {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  const handleProfile = () => {
    navigate('/profile');
  };
  
  return (
    <Flex
      as="header"
      position="sticky"
      top="0"
      zIndex="docked"
      bg={bgColor}
      borderBottom="1px"
      borderBottomColor={borderColor}
      px={4}
      h="16"
      alignItems="center"
      justifyContent="space-between"
    >
      <IconButton
        display={{ base: 'flex', md: 'none' }}
        onClick={onOpenSidebar}
        variant="outline"
        aria-label="open menu"
        icon={<FiMenu />}
      />
      
      <Text
        display={{ base: 'flex', md: 'none' }}
        fontSize="2xl"
        fontFamily="monospace"
        fontWeight="bold"
        color="brand.500"
      >
        Neo N3
      </Text>
      
      <HStack spacing={4}>
        <IconButton
          size="md"
          variant="ghost"
          aria-label="Toggle color mode"
          icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
          onClick={toggleColorMode}
        />
        
        <NotificationCenter />
        
        <Menu>
          <MenuButton
            as={Button}
            rounded="full"
            variant="link"
            cursor="pointer"
            minW={0}
          >
            <Avatar
              size="sm"
              name={user?.name || 'User'}
              src={user?.avatar}
            />
          </MenuButton>
          <MenuList>
            <MenuItem icon={<FiUser />} onClick={handleProfile}>Profile</MenuItem>
            <MenuDivider />
            <MenuItem icon={<FiLogOut />} onClick={logout}>
              Logout
            </MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  );
};

export default Header; 
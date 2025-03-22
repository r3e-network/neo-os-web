import React from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  Flex,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import Sidebar from '../navigation/Sidebar';
import Header from '../navigation/Header';

const DashboardLayout = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  
  return (
    <Flex h="100vh">
      {/* Sidebar */}
      <Sidebar isOpen={isOpen} onClose={onClose} />
      
      {/* Main content area */}
      <Box
        flex="1"
        bg={bgColor}
        ml={{ base: 0, md: isOpen ? '240px' : '80px' }}
        transition="margin-left 0.3s"
        overflowY="auto"
      >
        {/* Header */}
        <Header onOpenSidebar={onOpen} />
        
        {/* Page content */}
        <Box as="main" p={4} px={{ base: 4, lg: 8 }}>
          <Outlet />
        </Box>
      </Box>
    </Flex>
  );
};

export default DashboardLayout; 
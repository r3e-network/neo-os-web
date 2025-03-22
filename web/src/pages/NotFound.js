import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  Flex,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiHome } from 'react-icons/fi';

const NotFound = () => {
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  
  return (
    <Flex
      align="center"
      justify="center"
      h="100vh"
      w="full"
      bg={bgColor}
      p={4}
    >
      <VStack spacing={8} textAlign="center">
        <Heading size="4xl" color="brand.500">404</Heading>
        <Heading size="xl">Page Not Found</Heading>
        <Text fontSize="lg" maxW="md">
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Button
          as={RouterLink}
          to="/"
          leftIcon={<FiHome />}
          colorScheme="brand"
          size="lg"
        >
          Return Home
        </Button>
      </VStack>
    </Flex>
  );
};

export default NotFound; 
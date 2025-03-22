import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  Flex,
  useColorModeValue,
  InputGroup,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const bgColor = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // For demo purposes, just use hardcoded credentials
      // In production, this would call the login function from AuthContext
      // await login(email, password);
      
      // Mock successful login
      setTimeout(() => {
        localStorage.setItem('token', 'demo-token');
        // Simulate login without actual API call
        navigate('/');
        setIsLoading(false);
      }, 1500);
    } catch (err) {
      toast({
        title: 'Login Failed',
        description: err.message || 'Failed to log in. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
    }
  };
  
  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bg={useColorModeValue('gray.50', 'gray.800')}
      p={4}
    >
      <Box
        bg={bgColor}
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
        p={8}
        w={{ base: 'full', md: '400px' }}
        boxShadow="lg"
      >
        <VStack spacing={6} align="stretch">
          <Box textAlign="center">
            <Heading size="xl" mb={2} color="brand.500">Neo N3</Heading>
            <Text fontSize="lg" color="gray.500">Service Layer Dashboard</Text>
          </Box>
          
          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl id="email" isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </FormControl>
              
              <FormControl id="password" isRequired>
                <FormLabel>Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      icon={showPassword ? <FiEyeOff /> : <FiEye />}
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
              
              <Button
                type="submit"
                colorScheme="brand"
                size="lg"
                w="full"
                mt={4}
                isLoading={isLoading}
                loadingText="Logging in"
              >
                Sign In
              </Button>
            </VStack>
          </form>
          
          {error && (
            <Text color="red.500" mt={4} textAlign="center">
              {error}
            </Text>
          )}
          
          <Text textAlign="center" fontSize="sm" color="gray.500">
            Demo access: Use any email and password
          </Text>
        </VStack>
      </Box>
    </Flex>
  );
};

export default Login; 
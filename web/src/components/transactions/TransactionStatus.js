import React, { useState, useEffect } from 'react';
import {
  Badge,
  Box,
  Text,
  Progress,
  VStack,
  HStack,
  Icon,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { 
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiRefreshCw
} from 'react-icons/fi';
import transactionService from '../../services/transactionService';

// Status colors for different transaction states
const statusConfig = {
  created: {
    color: 'gray',
    icon: FiClock,
    text: 'Created',
    description: 'Transaction has been created but not yet submitted',
    progress: 5
  },
  submitted: {
    color: 'blue',
    icon: FiRefreshCw,
    text: 'Submitted',
    description: 'Transaction has been submitted to the blockchain',
    progress: 20
  },
  pending: {
    color: 'yellow',
    icon: FiClock,
    text: 'Pending',
    description: 'Transaction is in the mempool awaiting confirmation',
    progress: 40
  },
  confirming: {
    color: 'orange',
    icon: FiClock,
    text: 'Confirming',
    description: 'Transaction is included in a block but not fully confirmed',
    progress: 70
  },
  confirmed: {
    color: 'green',
    icon: FiCheckCircle,
    text: 'Confirmed',
    description: 'Transaction has been confirmed on the blockchain',
    progress: 100
  },
  failed: {
    color: 'red',
    icon: FiXCircle,
    text: 'Failed',
    description: 'Transaction execution failed',
    progress: 100
  },
  expired: {
    color: 'red',
    icon: FiAlertTriangle,
    text: 'Expired',
    description: 'Transaction expired before being included in a block',
    progress: 100
  },
  cancelled: {
    color: 'gray',
    icon: FiXCircle,
    text: 'Cancelled',
    description: 'Transaction was cancelled by the user',
    progress: 100
  }
};

// Format timestamp to readable date
const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// Transaction status component
const TransactionStatus = ({ transaction, showDetails = false }) => {
  const [currentTransaction, setCurrentTransaction] = useState(transaction);
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Subscribe to real-time updates for this transaction
  transactionService.useTransactionTracking(
    transaction?.id,
    (updatedData) => {
      setCurrentTransaction(prev => ({
        ...prev,
        status: updatedData.status,
        blockHeight: updatedData.blockHeight,
        blockTime: updatedData.blockTime,
        gasConsumed: updatedData.gasConsumed,
        error: updatedData.error
      }));
    }
  );
  
  const status = currentTransaction?.status?.toLowerCase() || 'created';
  const config = statusConfig[status] || statusConfig.created;
  
  // Determine if the transaction is in a final state
  const isFinalState = ['confirmed', 'failed', 'expired', 'cancelled'].includes(status);
  
  // Apply spinning animation to icon for in-progress transactions
  const iconProps = isFinalState 
    ? {} 
    : { className: 'rotating-icon', style: { animation: 'spin 2s linear infinite' } };
  
  // Style for showing spinning icon
  const spinStyle = !isFinalState ? `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .rotating-icon {
      animation: spin 2s linear infinite;
    }
  ` : '';
  
  return (
    <Box 
      p={showDetails ? 4 : 2} 
      borderWidth={showDetails ? "1px" : "0"} 
      borderRadius="md"
      borderColor={borderColor}
    >
      <style>{spinStyle}</style>
      
      <HStack spacing={3} mb={showDetails ? 4 : 0}>
        <Icon 
          as={config.icon} 
          color={`${config.color}.500`} 
          boxSize={5}
          {...iconProps}
        />
        <Badge colorScheme={config.color} fontSize="sm" px={2} py={1} borderRadius="full">
          {config.text}
        </Badge>
        {!isFinalState && (
          <Tooltip label="Live updates enabled">
            <Badge colorScheme="purple" variant="outline" fontSize="xs">LIVE</Badge>
          </Tooltip>
        )}
      </HStack>
      
      {showDetails && (
        <VStack align="start" spacing={3} mt={3}>
          <Progress 
            value={config.progress} 
            colorScheme={config.color}
            size="sm"
            width="100%"
            borderRadius="full"
          />
          
          <Box width="100%">
            <Text fontSize="sm" fontWeight="bold" mb={1}>Transaction Details</Text>
            <VStack spacing={1} align="start">
              <HStack>
                <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">ID:</Text>
                <Text fontSize="xs">{currentTransaction?.id || 'N/A'}</Text>
              </HStack>
              <HStack>
                <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">Hash:</Text>
                <Text fontSize="xs">{currentTransaction?.hash || 'N/A'}</Text>
              </HStack>
              <HStack>
                <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">Status:</Text>
                <Badge colorScheme={config.color} fontSize="xs">{config.text}</Badge>
              </HStack>
              <HStack>
                <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">Created At:</Text>
                <Text fontSize="xs">{formatDate(currentTransaction?.createdAt)}</Text>
              </HStack>
              {currentTransaction?.blockHeight && (
                <HStack>
                  <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">Block Height:</Text>
                  <Text fontSize="xs">{currentTransaction?.blockHeight}</Text>
                </HStack>
              )}
              {currentTransaction?.blockTime && (
                <HStack>
                  <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">Block Time:</Text>
                  <Text fontSize="xs">{formatDate(currentTransaction?.blockTime)}</Text>
                </HStack>
              )}
              {currentTransaction?.gasConsumed && (
                <HStack>
                  <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">Gas Consumed:</Text>
                  <Text fontSize="xs">{currentTransaction?.gasConsumed}</Text>
                </HStack>
              )}
              {currentTransaction?.error && (
                <HStack>
                  <Text fontSize="xs" fontWeight="medium" color="gray.500" width="120px">Error:</Text>
                  <Text fontSize="xs" color="red.500">{currentTransaction?.error}</Text>
                </HStack>
              )}
            </VStack>
          </Box>
        </VStack>
      )}
    </Box>
  );
};

export default TransactionStatus; 
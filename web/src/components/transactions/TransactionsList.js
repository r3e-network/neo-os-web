import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  HStack,
  Text,
  Flex,
  IconButton,
  useDisclosure,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiRefreshCw, FiInfo, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import transactionService from '../../services/transactionService';
import TransactionStatus from './TransactionStatus';

// Transaction list component with real-time updates
const TransactionsList = ({ service = null, entityId = null, limit = 10 }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  
  // Load initial transactions
  useEffect(() => {
    loadTransactions();
  }, [service, entityId, limit]);
  
  // Load transactions from API
  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        limit,
        page: 1
      };
      
      if (service) {
        params.service = service;
      }
      
      if (entityId) {
        params.entityId = entityId;
      }
      
      const response = await transactionService.listTransactions(params);
      setTransactions(response.transactions || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast({
        title: 'Error loading transactions',
        description: error.message || 'Failed to load transactions',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Subscribe to transaction updates in real-time
  transactionService.useTransactionsLiveUpdates((updatedTransaction) => {
    setTransactions(prevTransactions => {
      // Check if the updated transaction is in our list
      const index = prevTransactions.findIndex(tx => tx.id === updatedTransaction.id);
      
      if (index !== -1) {
        // Update the transaction in the list
        const newTransactions = [...prevTransactions];
        newTransactions[index] = {
          ...newTransactions[index],
          status: updatedTransaction.status,
          blockHeight: updatedTransaction.blockHeight,
          blockTime: updatedTransaction.blockTime,
          gasConsumed: updatedTransaction.gasConsumed,
          error: updatedTransaction.error
        };
        return newTransactions;
      }
      
      // If it's not in our list and we don't have service or entityId filter,
      // we might want to add it to the top of the list (if it belongs to the current view)
      if (!service && !entityId) {
        return [updatedTransaction, ...prevTransactions.slice(0, limit - 1)];
      }
      
      // If it's not in our list and we have filters, don't add it
      return prevTransactions;
    });
    
    // If the transaction is currently selected, update it
    if (selectedTransaction && selectedTransaction.id === updatedTransaction.id) {
      setSelectedTransaction(prevSelected => ({
        ...prevSelected,
        status: updatedTransaction.status,
        blockHeight: updatedTransaction.blockHeight,
        blockTime: updatedTransaction.blockTime,
        gasConsumed: updatedTransaction.gasConsumed,
        error: updatedTransaction.error
      }));
    }
  });
  
  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Handle view transaction details
  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    onOpen();
  };
  
  // Handle retry transaction
  const handleRetry = async (id) => {
    try {
      await transactionService.retryTransaction(id);
      toast({
        title: 'Transaction retry initiated',
        description: 'The transaction has been queued for retry',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to retry transaction:', error);
      toast({
        title: 'Error retrying transaction',
        description: error.message || 'Failed to retry transaction',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  // Handle cancel transaction
  const handleCancel = async (id) => {
    try {
      await transactionService.cancelTransaction(id);
      toast({
        title: 'Transaction cancelled',
        description: 'The transaction has been cancelled',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Failed to cancel transaction:', error);
      toast({
        title: 'Error cancelling transaction',
        description: error.message || 'Failed to cancel transaction',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };
  
  return (
    <Box 
      borderWidth="1px" 
      borderRadius="lg" 
      overflow="hidden"
      bg={bgColor}
    >
      <Flex justify="space-between" align="center" p={4} borderBottomWidth="1px">
        <Text fontWeight="semibold">Recent Transactions</Text>
        <HStack>
          <Badge colorScheme="purple" variant="outline">LIVE UPDATES</Badge>
          <IconButton
            size="sm"
            icon={<FiRefreshCw />}
            aria-label="Refresh transactions"
            onClick={loadTransactions}
            isLoading={loading}
          />
        </HStack>
      </Flex>
      
      {loading ? (
        <Flex justify="center" align="center" p={10}>
          <Spinner />
        </Flex>
      ) : transactions.length === 0 ? (
        <Box p={10} textAlign="center">
          <Text color="gray.500">No transactions found</Text>
        </Box>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Service</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {transactions.map((transaction) => (
                <Tr key={transaction.id}>
                  <Td>
                    <Text fontSize="xs" fontFamily="monospace">
                      {transaction.id.substring(0, 8)}...
                    </Text>
                  </Td>
                  <Td>
                    <Badge>{transaction.service}</Badge>
                  </Td>
                  <Td>
                    <Badge variant="outline">{transaction.type}</Badge>
                  </Td>
                  <Td>
                    <TransactionStatus transaction={transaction} />
                  </Td>
                  <Td>
                    <Text fontSize="xs">{formatDate(transaction.createdAt)}</Text>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <IconButton
                        size="xs"
                        icon={<FiInfo />}
                        aria-label="View details"
                        onClick={() => handleViewDetails(transaction)}
                      />
                      {transaction.status === 'failed' || transaction.status === 'expired' ? (
                        <IconButton
                          size="xs"
                          colorScheme="blue"
                          icon={<FiRefreshCw />}
                          aria-label="Retry transaction"
                          onClick={() => handleRetry(transaction.id)}
                        />
                      ) : null}
                      {transaction.status === 'created' || transaction.status === 'pending' ? (
                        <IconButton
                          size="xs"
                          colorScheme="red"
                          icon={<FiXCircle />}
                          aria-label="Cancel transaction"
                          onClick={() => handleCancel(transaction.id)}
                        />
                      ) : null}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
      
      {/* Transaction details modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Transaction Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedTransaction && (
              <TransactionStatus 
                transaction={selectedTransaction} 
                showDetails={true}
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default TransactionsList; 
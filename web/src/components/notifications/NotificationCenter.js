import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Icon,
  Text,
  Badge,
  Stack,
  Divider,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { FiBell } from 'react-icons/fi';
import { useWebSocket } from '../../context/WebSocketContext';
import { EVENT_TYPES } from '../../services/websocketService';

// Function to format notification time
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

// Single notification component
const NotificationItem = ({ notification, onMarkRead }) => {
  const bgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  
  // Determine badge color based on notification type
  let badgeColor = 'blue';
  switch (notification.type) {
    case EVENT_TYPES.TRANSACTION_UPDATED:
      badgeColor = notification.data.status === 'confirmed' ? 'green' 
                   : notification.data.status === 'failed' ? 'red'
                   : 'yellow';
      break;
    case EVENT_TYPES.SERVICE_STATUS_UPDATED:
      badgeColor = notification.data.status === 'healthy' ? 'green' : 'red';
      break;
    case EVENT_TYPES.PRICE_UPDATED:
      badgeColor = 'blue';
      break;
    case EVENT_TYPES.ORACLE_REQUEST_COMPLETED:
      badgeColor = 'purple';
      break;
    case EVENT_TYPES.RANDOM_NUMBER_GENERATED:
      badgeColor = 'cyan';
      break;
    default:
      badgeColor = 'gray';
  }
  
  return (
    <Box
      p={3}
      mb={2}
      borderWidth="1px"
      borderRadius="md"
      borderColor={borderColor}
      bg={bgColor}
      opacity={notification.read ? 0.7 : 1}
      _hover={{ shadow: 'sm' }}
    >
      <Flex justify="space-between" align="center" mb={1}>
        <Badge colorScheme={badgeColor} borderRadius="full" px={2}>
          {notification.category}
        </Badge>
        <Text fontSize="xs" color="gray.500">
          {formatTime(notification.timestamp)}
        </Text>
      </Flex>
      <Text fontWeight={notification.read ? 'normal' : 'semibold'} mb={2}>
        {notification.title}
      </Text>
      <Text fontSize="sm" color="gray.500">
        {notification.message}
      </Text>
      {!notification.read && (
        <Button
          size="xs"
          mt={2}
          colorScheme="blue"
          variant="outline"
          onClick={() => onMarkRead(notification.id)}
        >
          Mark as read
        </Button>
      )}
    </Box>
  );
};

// Notification center component
const NotificationCenter = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { 
    subscribeToTransactionUpdates,
    subscribeToServiceStatusUpdates,
    subscribeToPriceUpdates,
    subscribeToOracleRequestCompletions,
    subscribeToRandomNumberGenerations,
    subscribeToFunctionExecutions,
    subscribeToTriggerFirings
  } = useWebSocket();
  
  // Function to add a new notification
  const addNotification = (type, category, title, message, data) => {
    const newNotification = {
      id: Date.now(),
      type,
      category,
      title,
      message,
      timestamp: new Date(),
      read: false,
      data
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };
  
  // Function to mark a notification as read
  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };
  
  // Function to mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
    setUnreadCount(0);
  };
  
  // Subscribe to transaction updates
  useEffect(() => {
    const unsubscribe = subscribeToTransactionUpdates((data) => {
      let title = `Transaction ${data.id.substring(0, 8)}...`;
      let message = '';
      
      switch (data.status) {
        case 'confirmed':
          title = `Transaction Confirmed`;
          message = `Transaction ${data.id.substring(0, 8)}... has been confirmed on block ${data.blockHeight}`;
          break;
        case 'failed':
          title = `Transaction Failed`;
          message = `Transaction ${data.id.substring(0, 8)}... has failed: ${data.error || 'Unknown error'}`;
          break;
        case 'pending':
          title = `Transaction Pending`;
          message = `Transaction ${data.id.substring(0, 8)}... has been submitted and is pending confirmation`;
          break;
        default:
          title = `Transaction Updated`;
          message = `Transaction ${data.id.substring(0, 8)}... status changed to ${data.status}`;
      }
      
      addNotification(
        EVENT_TYPES.TRANSACTION_UPDATED,
        'Transaction',
        title,
        message,
        data
      );
    });
    
    return unsubscribe;
  }, [subscribeToTransactionUpdates]);
  
  // Subscribe to service status updates
  useEffect(() => {
    const unsubscribe = subscribeToServiceStatusUpdates((data) => {
      const title = `${data.service} Service ${data.status === 'healthy' ? 'Healthy' : 'Unhealthy'}`;
      const message = `The ${data.service} service is now ${data.status}${data.details ? `: ${data.details}` : ''}`;
      
      addNotification(
        EVENT_TYPES.SERVICE_STATUS_UPDATED,
        'Service Status',
        title,
        message,
        data
      );
    });
    
    return unsubscribe;
  }, [subscribeToServiceStatusUpdates]);
  
  // Subscribe to price updates
  useEffect(() => {
    const unsubscribe = subscribeToPriceUpdates((data) => {
      const title = `Price Updated: ${data.symbol}`;
      const message = `${data.symbol} price updated to ${data.price} USD`;
      
      addNotification(
        EVENT_TYPES.PRICE_UPDATED,
        'Price Feed',
        title,
        message,
        data
      );
    });
    
    return unsubscribe;
  }, [subscribeToPriceUpdates]);
  
  // Subscribe to oracle request completions
  useEffect(() => {
    const unsubscribe = subscribeToOracleRequestCompletions((data) => {
      const title = `Oracle Request Completed`;
      const message = `Oracle request ${data.requestId.substring(0, 8)}... has been completed`;
      
      addNotification(
        EVENT_TYPES.ORACLE_REQUEST_COMPLETED,
        'Oracle',
        title,
        message,
        data
      );
    });
    
    return unsubscribe;
  }, [subscribeToOracleRequestCompletions]);
  
  // Subscribe to random number generations
  useEffect(() => {
    const unsubscribe = subscribeToRandomNumberGenerations((data) => {
      const title = `Random Number Generated`;
      const message = `Random number request ${data.requestId.substring(0, 8)}... has been fulfilled`;
      
      addNotification(
        EVENT_TYPES.RANDOM_NUMBER_GENERATED,
        'Random Number',
        title,
        message,
        data
      );
    });
    
    return unsubscribe;
  }, [subscribeToRandomNumberGenerations]);
  
  // Subscribe to function executions
  useEffect(() => {
    const unsubscribe = subscribeToFunctionExecutions((data) => {
      const title = `Function Executed`;
      const status = data.success ? 'successfully' : 'with errors';
      const message = `Function "${data.functionName}" executed ${status}`;
      
      addNotification(
        EVENT_TYPES.FUNCTION_EXECUTED,
        'Functions',
        title,
        message,
        data
      );
    });
    
    return unsubscribe;
  }, [subscribeToFunctionExecutions]);
  
  // Subscribe to trigger firings
  useEffect(() => {
    const unsubscribe = subscribeToTriggerFirings((data) => {
      const title = `Automation Trigger Fired`;
      const message = `Trigger "${data.triggerName}" fired and executed ${data.success ? 'successfully' : 'with errors'}`;
      
      addNotification(
        EVENT_TYPES.TRIGGER_FIRED,
        'Automation',
        title,
        message,
        data
      );
    });
    
    return unsubscribe;
  }, [subscribeToTriggerFirings]);
  
  return (
    <>
      <Button 
        variant="ghost" 
        colorScheme="blue" 
        borderRadius="full" 
        position="relative"
        onClick={onOpen}
      >
        <Icon as={FiBell} boxSize={5} />
        {unreadCount > 0 && (
          <Badge 
            colorScheme="red" 
            borderRadius="full" 
            position="absolute" 
            top="-6px" 
            right="-6px"
            minW="18px"
            fontSize="xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>
      
      <Drawer
        isOpen={isOpen}
        placement="right"
        onClose={onClose}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>
            <Flex justify="space-between" align="center">
              <Text>Notifications</Text>
              {notifications.length > 0 && (
                <Button size="sm" variant="outline" onClick={markAllAsRead}>
                  Mark all as read
                </Button>
              )}
            </Flex>
          </DrawerHeader>
          <Divider />
          <DrawerBody p={4}>
            {notifications.length === 0 ? (
              <Flex
                height="100%"
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
                py={10}
              >
                <Icon as={FiBell} boxSize={10} color="gray.400" mb={3} />
                <Text color="gray.500">No notifications yet</Text>
              </Flex>
            ) : (
              <Stack spacing={4}>
                {notifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                  />
                ))}
              </Stack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default NotificationCenter; 
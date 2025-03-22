import React from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Icon,
  Tooltip,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiInfo } from 'react-icons/fi';

// Analytics card component for displaying stats with optional chart
const AnalyticsCard = ({
  title,
  value,
  helpText,
  change,
  changeType = 'increase',
  icon,
  chart,
  isLoading = false,
  tooltipText,
  ...rest
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  return (
    <Box
      bg={bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
      boxShadow="sm"
      transition="all 0.2s"
      _hover={{ boxShadow: 'md' }}
      {...rest}
    >
      <Box p={5}>
        <Flex mb={2} justify="space-between" align="center">
          <Flex align="center">
            <Heading size="sm" mr={1}>{title}</Heading>
            {tooltipText && (
              <Tooltip label={tooltipText}>
                <span>
                  <Icon as={FiInfo} color="gray.500" boxSize={3} />
                </span>
              </Tooltip>
            )}
          </Flex>
          {icon && (
            <Icon as={icon} boxSize={5} color="brand.500" />
          )}
        </Flex>
        
        <Stat>
          {isLoading ? (
            <Flex h="60px" align="center" justify="center">
              <Spinner />
            </Flex>
          ) : (
            <>
              <StatNumber fontSize="2xl" fontWeight="bold">
                {value}
              </StatNumber>
              <StatHelpText mb={0}>
                {change && (
                  <StatArrow type={changeType} />
                )}
                {change && `${change} `}
                {helpText}
              </StatHelpText>
            </>
          )}
        </Stat>
      </Box>
      
      {chart && !isLoading && (
        <Box height="100px" width="100%">
          {chart}
        </Box>
      )}
    </Box>
  );
};

export default AnalyticsCard; 
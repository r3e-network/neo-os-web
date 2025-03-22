import React from 'react';
import {
  Box,
  Flex,
  FormControl,
  FormLabel,
  Select,
  Input,
  Button,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react';

const timeRanges = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '12h', label: 'Last 12 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const MetricsFilter = ({
  timeRange = '24h',
  onTimeRangeChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  service,
  onServiceChange,
  services = [],
  showServiceFilter = false,
  onApplyFilters,
  onResetFilters,
  isCustomRange = false,
  ...props
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  return (
    <Box
      p={4}
      bg={bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      mb={4}
      {...props}
    >
      <Flex 
        direction={{ base: 'column', md: 'row' }} 
        gap={4}
        align={{ base: 'stretch', md: 'flex-end' }}
      >
        <FormControl flex="1">
          <FormLabel fontSize="sm">Time Range</FormLabel>
          <Select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value)}
            size="sm"
          >
            {timeRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </Select>
        </FormControl>
        
        {isCustomRange && (
          <>
            <FormControl flex="1">
              <FormLabel fontSize="sm">Start Date</FormLabel>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                size="sm"
              />
            </FormControl>
            
            <FormControl flex="1">
              <FormLabel fontSize="sm">End Date</FormLabel>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                size="sm"
              />
            </FormControl>
          </>
        )}
        
        {showServiceFilter && (
          <FormControl flex="1">
            <FormLabel fontSize="sm">Service</FormLabel>
            <Select
              value={service}
              onChange={(e) => onServiceChange(e.target.value)}
              size="sm"
            >
              <option value="all">All Services</option>
              {services.map(s => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </FormControl>
        )}
        
        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={onApplyFilters}
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onResetFilters}
          >
            Reset
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
};

export default MetricsFilter; 
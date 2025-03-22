import React, { useState } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  Flex,
  Button,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  HStack,
  Spinner,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiChevronRight,
  FiChevronLeft,
  FiDownload,
  FiMoreVertical,
} from 'react-icons/fi';

const MetricsTable = ({
  data = [],
  columns = [],
  isLoading = false,
  sorting = {
    field: null,
    direction: 'asc',
  },
  onSort,
  filtering = {
    searchText: '',
  },
  onSearch,
  pagination = {
    page: 1,
    pageSize: 10,
    totalItems: 0,
  },
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onExport,
  enableRowActions = false,
  rowActions = [],
  ...props
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBgColor = useColorModeValue('gray.50', 'gray.700');
  
  // Local search state (if not using external search)
  const [localSearchText, setLocalSearchText] = useState('');
  
  // Calculate total pages
  const totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);
  
  // Format date/time values
  const formatValue = (value, type) => {
    if (value === null || value === undefined) return '-';
    
    switch (type) {
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'currency':
        return typeof value === 'number' 
          ? `$${value.toFixed(2)}` 
          : value;
      case 'percentage':
        return typeof value === 'number' 
          ? `${(value * 100).toFixed(2)}%` 
          : value;
      case 'number':
        return typeof value === 'number' 
          ? value.toLocaleString() 
          : value;
      case 'status':
        return (
          <Badge 
            colorScheme={
              value === 'success' || value === 'completed' || value === 'active' ? 'green' :
              value === 'pending' || value === 'processing' ? 'yellow' :
              value === 'failed' || value === 'error' ? 'red' :
              'gray'
            }
          >
            {value}
          </Badge>
        );
      default:
        return String(value);
    }
  };
  
  // Handle local search if onSearch not provided
  const handleSearch = (e) => {
    const value = e.target.value;
    setLocalSearchText(value);
    if (onSearch) {
      onSearch(value);
    }
  };
  
  // Handle sorting
  const handleSort = (field) => {
    if (onSort) {
      let direction = 'asc';
      
      if (sorting.field === field) {
        direction = sorting.direction === 'asc' ? 'desc' : 'asc';
      }
      
      onSort(field, direction);
    }
  };
  
  // Handle pagination
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages && onPageChange) {
      onPageChange(page);
    }
  };
  
  // Get displayed data (with local filtering/sorting if needed)
  const getDisplayedData = () => {
    let displayedData = [...data];
    
    // Apply local filtering if onSearch not provided
    if (!onSearch && localSearchText) {
      displayedData = displayedData.filter(item => {
        return Object.values(item).some(value => 
          String(value).toLowerCase().includes(localSearchText.toLowerCase())
        );
      });
    }
    
    return displayedData;
  };
  
  // Render table content
  const renderTableContent = () => {
    const displayedData = getDisplayedData();
    
    if (isLoading) {
      return (
        <Tr>
          <Td colSpan={columns.length + (enableRowActions ? 1 : 0)}>
            <Flex justify="center" align="center" py={10}>
              <Spinner size="lg" />
            </Flex>
          </Td>
        </Tr>
      );
    }
    
    if (displayedData.length === 0) {
      return (
        <Tr>
          <Td colSpan={columns.length + (enableRowActions ? 1 : 0)}>
            <Text textAlign="center" py={10} color="gray.500">
              No data available
            </Text>
          </Td>
        </Tr>
      );
    }
    
    return displayedData.map((row, rowIndex) => (
      <Tr 
        key={row.id || rowIndex}
        _hover={{ bg: hoverBgColor }}
        cursor={onRowClick ? 'pointer' : 'default'}
        onClick={() => onRowClick && onRowClick(row)}
      >
        {columns.map((column, colIndex) => (
          <Td key={column.field || colIndex}>
            {formatValue(row[column.field], column.type)}
          </Td>
        ))}
        
        {enableRowActions && rowActions.length > 0 && (
          <Td textAlign="right">
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<FiMoreVertical />}
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
              />
              <MenuList>
                {rowActions.map((action, index) => (
                  <MenuItem
                    key={index}
                    icon={action.icon}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(row);
                    }}
                    isDisabled={action.isDisabled?.(row)}
                  >
                    {action.label}
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          </Td>
        )}
      </Tr>
    ));
  };
  
  return (
    <Box
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
      bg={bgColor}
      {...props}
    >
      {/* Table controls */}
      <Flex
        justify="space-between"
        align="center"
        p={4}
        borderBottomWidth="1px"
        borderBottomColor={borderColor}
        wrap="wrap"
        gap={3}
      >
        <Box flex="1" minW={{ base: '100%', md: '300px' }}>
          <InputGroup size="sm">
            <InputLeftElement pointerEvents="none">
              <FiSearch color="gray.300" />
            </InputLeftElement>
            <Input
              placeholder="Search..."
              value={onSearch ? filtering.searchText : localSearchText}
              onChange={handleSearch}
            />
          </InputGroup>
        </Box>
        
        <HStack spacing={2}>
          {onExport && (
            <Button
              size="sm"
              leftIcon={<FiDownload />}
              variant="outline"
              onClick={onExport}
            >
              Export
            </Button>
          )}
          
          <Select
            size="sm"
            value={pagination.pageSize}
            onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
            width="auto"
          >
            <option value="10">10 rows</option>
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
          </Select>
        </HStack>
      </Flex>
      
      {/* Table */}
      <Box overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              {columns.map((column, index) => (
                <Th 
                  key={column.field || index}
                  cursor={onSort ? 'pointer' : 'default'}
                  onClick={() => onSort && handleSort(column.field)}
                >
                  <Flex align="center">
                    {column.label}
                    {onSort && sorting.field === column.field && (
                      <Box ml={1}>
                        {sorting.direction === 'asc' ? (
                          <FiChevronUp size="14px" />
                        ) : (
                          <FiChevronDown size="14px" />
                        )}
                      </Box>
                    )}
                  </Flex>
                </Th>
              ))}
              
              {enableRowActions && rowActions.length > 0 && (
                <Th width="60px"></Th>
              )}
            </Tr>
          </Thead>
          <Tbody>
            {renderTableContent()}
          </Tbody>
        </Table>
      </Box>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <Flex
          justify="space-between"
          align="center"
          p={4}
          borderTopWidth="1px"
          borderTopColor={borderColor}
        >
          <Text fontSize="sm" color="gray.500">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {
              Math.min(pagination.page * pagination.pageSize, pagination.totalItems)
            } of {pagination.totalItems} entries
          </Text>
          
          <HStack>
            <IconButton
              icon={<FiChevronLeft />}
              size="sm"
              variant="ghost"
              isDisabled={pagination.page === 1}
              onClick={() => goToPage(pagination.page - 1)}
              aria-label="Previous page"
            />
            
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNumber;
              
              if (totalPages <= 5) {
                // Show all pages if 5 or fewer
                pageNumber = i + 1;
              } else if (pagination.page <= 3) {
                // Near the start
                pageNumber = i + 1;
              } else if (pagination.page >= totalPages - 2) {
                // Near the end
                pageNumber = totalPages - 4 + i;
              } else {
                // In the middle
                pageNumber = pagination.page - 2 + i;
              }
              
              return (
                <Button
                  key={i}
                  size="sm"
                  variant={pagination.page === pageNumber ? 'solid' : 'ghost'}
                  colorScheme={pagination.page === pageNumber ? 'blue' : undefined}
                  onClick={() => goToPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              );
            })}
            
            <IconButton
              icon={<FiChevronRight />}
              size="sm"
              variant="ghost"
              isDisabled={pagination.page === totalPages}
              onClick={() => goToPage(pagination.page + 1)}
              aria-label="Next page"
            />
          </HStack>
        </Flex>
      )}
    </Box>
  );
};

export default MetricsTable; 
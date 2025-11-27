import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  TablePagination,
} from '@mui/material';
import { Visibility } from '@mui/icons-material';

interface Order {
  id: string;
  service: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  amount: number;
  created_at: string;
  completed_at?: string;
}

const OrdersPage: React.FC = () => {
  const [orders] = React.useState<Order[]>([
    {
      id: 'ORD-001',
      service: 'Web Development',
      status: 'completed',
      amount: 2500,
      created_at: '2024-11-15',
      completed_at: '2024-11-20',
    },
    {
      id: 'ORD-002',
      service: 'UI/UX Design',
      status: 'in_progress',
      amount: 1500,
      created_at: '2024-11-18',
    },
    {
      id: 'ORD-003',
      service: 'Digital Marketing',
      status: 'pending',
      amount: 1000,
      created_at: '2024-11-22',
    },
  ]);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Orders
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order ID</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Created Date</TableCell>
              <TableCell>Completed Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.service}</TableCell>
                <TableCell>
                  <Chip 
                    label={order.status.replace('_', ' ')} 
                    color={getStatusColor(order.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>${order.amount.toLocaleString()}</TableCell>
                <TableCell>{order.created_at}</TableCell>
                <TableCell>{order.completed_at || '-'}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    startIcon={<Visibility />}
                    variant="outlined"
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={orders.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};

export default OrdersPage;
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
  TextField,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Visibility, Reply } from '@mui/icons-material';

interface SupportTicket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  last_reply: string;
  replies: number;
}

const SupportTicketsPage: React.FC = () => {
  const [tickets] = React.useState<SupportTicket[]>([
    {
      id: 'TICK-001',
      subject: 'Website loading issues',
      status: 'resolved',
      priority: 'high',
      created_at: '2024-11-20',
      last_reply: '2024-11-21',
      replies: 3,
    },
    {
      id: 'TICK-002',
      subject: 'Payment processing error',
      status: 'in_progress',
      priority: 'medium',
      created_at: '2024-11-22',
      last_reply: '2024-11-22',
      replies: 1,
    },
    {
      id: 'TICK-003',
      subject: 'Feature request: Mobile app',
      status: 'open',
      priority: 'low',
      created_at: '2024-11-23',
      last_reply: '2024-11-23',
      replies: 0,
    },
  ]);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [openDialog, setOpenDialog] = React.useState(false);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreateTicket = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'open':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Support Tickets
        </Typography>
        <Button variant="contained" color="primary" onClick={handleCreateTicket}>
          Create New Ticket
        </Button>
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket ID</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Created Date</TableCell>
              <TableCell>Last Reply</TableCell>
              <TableCell>Replies</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>{ticket.id}</TableCell>
                <TableCell>{ticket.subject}</TableCell>
                <TableCell>
                  <Chip 
                    label={ticket.status.replace('_', ' ')} 
                    color={getStatusColor(ticket.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={ticket.priority} 
                    color={getPriorityColor(ticket.priority)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{ticket.created_at}</TableCell>
                <TableCell>{ticket.last_reply}</TableCell>
                <TableCell>{ticket.replies}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    startIcon={<Visibility />}
                    variant="outlined"
                    sx={{ mr: 1 }}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Reply />}
                    variant="outlined"
                  >
                    Reply
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={tickets.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Support Ticket</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please fill out the form below to create a new support ticket.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Subject"
            fullWidth
            variant="outlined"
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            variant="outlined"
            multiline
            rows={4}
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Priority"
            select
            fullWidth
            variant="outlined"
            SelectProps={{ native: true }}
            sx={{ mt: 2 }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleCloseDialog} variant="contained">
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SupportTicketsPage;
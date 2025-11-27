import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
} from '@mui/material'
import {
  TrendingUp,
  People,
  ShoppingCart,
  AttachMoney,
  Timeline,
} from '@mui/icons-material'

const AdminDashboard: React.FC = () => {
  const stats = [
    {
      title: 'Total Users',
      value: '1,234',
      change: '+12%',
      icon: <People sx={{ fontSize: 40 }} />,
      color: 'primary.main',
    },
    {
      title: 'Total Orders',
      value: '856',
      change: '+8%',
      icon: <ShoppingCart sx={{ fontSize: 40 }} />,
      color: 'success.main',
    },
    {
      title: 'Revenue',
      value: '$45,678',
      change: '+15%',
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: 'warning.main',
    },
    {
      title: 'Conversion Rate',
      value: '3.2%',
      change: '+2%',
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: 'info.main',
    },
  ]

  const recentActivities = [
    {
      user: 'John Doe',
      action: 'Created new order',
      time: '2 minutes ago',
      type: 'order',
    },
    {
      user: 'Jane Smith',
      action: 'Updated profile',
      time: '15 minutes ago',
      type: 'profile',
    },
    {
      user: 'Mike Johnson',
      action: 'Submitted support ticket',
      time: '1 hour ago',
      type: 'ticket',
    },
    {
      user: 'Sarah Wilson',
      action: 'Completed service purchase',
      time: '2 hours ago',
      type: 'purchase',
    },
    {
      user: 'David Brown',
      action: 'Left testimonial',
      time: '3 hours ago',
      type: 'testimonial',
    },
  ]

  const recentOrders = [
    {
      id: 'ORD-001',
      customer: 'John Doe',
      service: 'Web Development',
      amount: '$2,500',
      status: 'completed',
      date: '2024-03-15',
    },
    {
      id: 'ORD-002',
      customer: 'Jane Smith',
      service: 'UI/UX Design',
      amount: '$1,500',
      status: 'in_progress',
      date: '2024-03-14',
    },
    {
      id: 'ORD-003',
      customer: 'Mike Johnson',
      service: 'Cloud Migration',
      amount: '$3,000',
      status: 'pending',
      date: '2024-03-13',
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'in_progress':
        return 'warning'
      case 'pending':
        return 'info'
      default:
        return 'default'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return '📦'
      case 'profile':
        return '👤'
      case 'ticket':
        return '🎫'
      case 'purchase':
        return '💳'
      case 'testimonial':
        return '⭐'
      default:
        return '📋'
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Dashboard Overview
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid size={{ xs: 12, md: 6, lg: 3 }} key={index}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      {stat.change} from last month
                    </Typography>
                  </Box>
                  <Box sx={{ color: stat.color }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Activities */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Activities
              </Typography>
              <Box sx={{ mt: 2 }}>
                {recentActivities.map((activity, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2, pb: 2, borderBottom: index < recentActivities.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                    <Avatar sx={{ mr: 2, backgroundColor: 'primary.light' }}>
                      {getActivityIcon(activity.type)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {activity.user}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activity.action}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {activity.time}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Orders */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Orders
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Order ID</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{order.id}</TableCell>
                        <TableCell>{order.customer}</TableCell>
                        <TableCell>{order.service}</TableCell>
                        <TableCell>{order.amount}</TableCell>
                        <TableCell>
                          <Chip
                            label={order.status.replace('_', ' ').toUpperCase()}
                            color={getStatusColor(order.status) as any}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default AdminDashboard
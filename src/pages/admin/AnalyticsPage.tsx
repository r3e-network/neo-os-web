import React from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, } from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  ShoppingCart,
  AttachMoney,
  Visibility,
} from '@mui/icons-material';

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, color }) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="h6">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              {change >= 0 ? (
                <TrendingUp color="success" sx={{ mr: 0.5 }} />
              ) : (
                <TrendingDown color="error" sx={{ mr: 0.5 }} />
              )}
              <Typography
                variant="body2"
                color={change >= 0 ? 'success.main' : 'error.main'}
              >
                {Math.abs(change)}%
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}20`,
              borderRadius: '50%',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const AnalyticsPage: React.FC = () => {
  const [metrics] = React.useState([
    {
      title: 'Total Users',
      value: '2,431',
      change: 12.5,
      icon: <People sx={{ color: '#1976d2' }} />,
      color: '#1976d2',
    },
    {
      title: 'Total Orders',
      value: '1,234',
      change: 8.2,
      icon: <ShoppingCart sx={{ color: '#dc004e' }} />,
      color: '#dc004e',
    },
    {
      title: 'Revenue',
      value: '$45,678',
      change: -2.4,
      icon: <AttachMoney sx={{ color: '#388e3c' }} />,
      color: '#388e3c',
    },
    {
      title: 'Page Views',
      value: '98,765',
      change: 15.7,
      icon: <Visibility sx={{ color: '#f57c00' }} />,
      color: '#f57c00',
    },
  ]);

  const [topServices] = React.useState([
    { name: 'Web Development', orders: 145, revenue: '$28,500', growth: 15 },
    { name: 'Mobile App Development', orders: 89, revenue: '$42,300', growth: 8 },
    { name: 'UI/UX Design', orders: 234, revenue: '$18,700', growth: 22 },
    { name: 'Digital Marketing', orders: 67, revenue: '$15,200', growth: -5 },
  ]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {metrics.map((metric, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <MetricCard {...metric} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Services Performance
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Service Name</TableCell>
                    <TableCell align="right">Orders</TableCell>
                    <TableCell align="right">Revenue</TableCell>
                    <TableCell align="right">Growth</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topServices.map((service, index) => (
                    <TableRow key={index}>
                      <TableCell>{service.name}</TableCell>
                      <TableCell align="right">{service.orders}</TableCell>
                      <TableCell align="right">{service.revenue}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${service.growth >= 0 ? '+' : ''}${service.growth}%`}
                          color={service.growth >= 0 ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              System Health
            </Typography>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" gutterBottom>
                Server CPU Usage
              </Typography>
              <LinearProgress variant="determinate" value={65} sx={{ mb: 2 }} />
              <Typography variant="body2" gutterBottom>
                Memory Usage
              </Typography>
              <LinearProgress variant="determinate" value={78} sx={{ mb: 2 }} />
              <Typography variant="body2" gutterBottom>
                Database Connections
              </Typography>
              <LinearProgress variant="determinate" value={42} sx={{ mb: 2 }} />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
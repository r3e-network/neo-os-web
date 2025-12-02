import { Box, Typography, Button, Grid, Card, CardContent, Chip } from '@mui/material';
import { Link } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import CodeIcon from '@mui/icons-material/Code';
import { useServices } from '../context/ServiceContext';

export default function HomePage() {
  const { services } = useServices();
  const featuredServices = services.slice(0, 6);

  const features = [
    {
      icon: <SecurityIcon sx={{ fontSize: 40 }} />,
      title: 'Secure by Design',
      description: 'TEE-based confidential computing with hardware-level security guarantees.',
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 40 }} />,
      title: 'High Performance',
      description: 'Optimized for low latency and high throughput blockchain operations.',
    },
    {
      icon: <CodeIcon sx={{ fontSize: 40 }} />,
      title: 'Developer Friendly',
      description: 'Comprehensive SDKs and APIs for seamless integration.',
    },
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          px: 2,
          background: 'radial-gradient(ellipse at center, rgba(0, 229, 153, 0.1) 0%, transparent 70%)',
          borderRadius: 4,
          mb: 6,
        }}
      >
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800,
            mb: 2,
            background: 'linear-gradient(90deg, #ffffff 0%, #00e599 50%, #7b61ff 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Service Layer
        </Typography>
        <Typography
          variant="h5"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
        >
          The decentralized infrastructure layer powering next-generation blockchain services
        </Typography>
        <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
          <Button
            component={Link}
            to="/services"
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            sx={{
              background: 'linear-gradient(90deg, #00e599, #00b377)',
              px: 4,
              py: 1.5,
              '&:hover': {
                background: 'linear-gradient(90deg, #00b377, #009966)',
              },
            }}
          >
            Explore Services
          </Button>
          <Button
            component={Link}
            to="/docs"
            variant="outlined"
            size="large"
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.3)',
              color: 'white',
              px: 4,
              py: 1.5,
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'rgba(0, 229, 153, 0.08)',
              },
            }}
          >
            Documentation
          </Button>
        </Box>
      </Box>

      {/* Features Section */}
      <Box sx={{ mb: 8 }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" mb={4}>
          Why Service Layer?
        </Typography>
        <Grid container spacing={3}>
          {features.map((feature, index) => (
            <Grid size={{ xs: 12, md: 4 }} key={index}>
              <Card
                className="glass-card"
                sx={{
                  height: '100%',
                  textAlign: 'center',
                  p: 2,
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" fontWeight={600} mb={1}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Featured Services */}
      <Box sx={{ mb: 8 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={700}>
            Featured Services
          </Typography>
          <Button
            component={Link}
            to="/services"
            endIcon={<ArrowForwardIcon />}
            sx={{ color: 'primary.main' }}
          >
            View All
          </Button>
        </Box>
        <Grid container spacing={3}>
          {featuredServices.map((service) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service.id}>
              <Card
                component={Link}
                to={`/services/${service.id}`}
                className="service-card glass-card"
                sx={{
                  textDecoration: 'none',
                  display: 'block',
                  height: '100%',
                }}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" fontWeight={600} color="text.primary">
                      {service.name}
                    </Typography>
                    <Chip
                      label={service.status}
                      size="small"
                      sx={{
                        backgroundColor:
                          service.status === 'online'
                            ? 'rgba(0, 229, 153, 0.2)'
                            : 'rgba(255, 71, 87, 0.2)',
                        color: service.status === 'online' ? '#00e599' : '#ff4757',
                      }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {service.description}
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {service.capabilities?.slice(0, 3).map((cap) => (
                      <Chip
                        key={cap}
                        label={cap}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: 'rgba(255, 255, 255, 0.2)',
                          color: 'text.secondary',
                          fontSize: '0.7rem',
                        }}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Stats Section */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 3,
          p: 4,
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(0, 229, 153, 0.1) 0%, rgba(123, 97, 255, 0.1) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {[
          { value: '14+', label: 'Services' },
          { value: '99.9%', label: 'Uptime' },
          { value: '< 100ms', label: 'Latency' },
          { value: '24/7', label: 'Support' },
        ].map((stat, index) => (
          <Box key={index} textAlign="center">
            <Typography
              variant="h3"
              fontWeight={700}
              sx={{
                background: 'linear-gradient(90deg, #00e599, #7b61ff)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {stat.value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

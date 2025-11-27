import React from 'react'
import { Box, Container, Typography, Button, Grid, Card, CardContent, CardActions, Avatar, Rating, Chip, } from '@mui/material'
import {
  Code,
  DesignServices,
  Analytics,
  SupportAgent,
  Cloud,
  Security,
  ArrowForward,
  Phone,
  Email,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const HomePage: React.FC = () => {
  const navigate = useNavigate()

  const services = [
    {
      icon: <Code sx={{ fontSize: 40 }} />,
      title: 'Web Development',
      description: 'Custom web applications built with modern technologies and best practices.',
      category: 'Development',
      price: 'Starting at $2,500',
    },
    {
      icon: <DesignServices sx={{ fontSize: 40 }} />,
      title: 'UI/UX Design',
      description: 'Beautiful and intuitive user interfaces that enhance user experience.',
      category: 'Design',
      price: 'Starting at $1,500',
    },
    {
      icon: <Analytics sx={{ fontSize: 40 }} />,
      title: 'Data Analytics',
      description: 'Transform your data into actionable insights with advanced analytics.',
      category: 'Analytics',
      price: 'Starting at $3,000',
    },
    {
      icon: <Cloud sx={{ fontSize: 40 }} />,
      title: 'Cloud Solutions',
      description: 'Scalable cloud infrastructure and deployment solutions.',
      category: 'Infrastructure',
      price: 'Starting at $1,000',
    },
    {
      icon: <Security sx={{ fontSize: 40 }} />,
      title: 'Cybersecurity',
      description: 'Comprehensive security solutions to protect your digital assets.',
      category: 'Security',
      price: 'Starting at $2,000',
    },
    {
      icon: <SupportAgent sx={{ fontSize: 40 }} />,
      title: '24/7 Support',
      description: 'Round-the-clock technical support and maintenance services.',
      category: 'Support',
      price: 'Starting at $500/month',
    },
  ]

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'CEO, TechStart Inc.',
      rating: 5,
      comment: 'Exceptional service and outstanding results. The team delivered exactly what we needed on time and within budget.',
      avatar: 'SJ',
    },
    {
      name: 'Michael Chen',
      role: 'CTO, InnovateLabs',
      rating: 5,
      comment: 'Professional, reliable, and innovative. They transformed our digital presence completely.',
      avatar: 'MC',
    },
    {
      name: 'Emily Rodriguez',
      role: 'Marketing Director, GrowthCo',
      rating: 4,
      comment: 'Great communication and project management. Highly recommend their services.',
      avatar: 'ER',
    },
  ]

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          color: 'white',
          py: { xs: 6, md: 8 },
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              mb: 3,
              fontSize: { xs: '2rem', md: '3rem', lg: '3.5rem' },
              animation: 'fadeInUp 1s ease-out',
            }}
          >
            Transform Your Business with Professional Services
          </Typography>
          <Typography
            variant="h5"
            component="p"
            sx={{
              mb: 4,
              opacity: 0.9,
              maxWidth: '600px',
              mx: 'auto',
              fontSize: { xs: '1.1rem', md: '1.25rem' },
            }}
          >
            We deliver cutting-edge solutions that drive growth, enhance efficiency, and create exceptional user experiences.
          </Typography>
          <Box 
            sx={{ 
              display: 'flex', 
              gap: 2, 
              justifyContent: 'center', 
              flexWrap: 'wrap',
              flexDirection: { xs: 'column', sm: 'row' },
              maxWidth: { xs: '300px', sm: 'none' },
              mx: 'auto',
            }}
          >
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => navigate('/services')}
              sx={{
                backgroundColor: 'white',
                color: 'primary.main',
                px: { xs: 3, md: 4 },
                py: { xs: 1.5, md: 2 },
                fontSize: { xs: '0.9rem', md: '1rem' },
                '&:hover': {
                  backgroundColor: 'grey.100',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Explore Services
            </Button>
            <Button
              variant="outlined"
              size="large"
              endIcon={<Phone />}
              onClick={() => navigate('/contact')}
              sx={{
                borderColor: 'white',
                color: 'white',
                px: { xs: 3, md: 4 },
                py: { xs: 1.5, md: 2 },
                fontSize: { xs: '0.9rem', md: '1rem' },
                '&:hover': {
                  borderColor: 'grey.200',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Get Consultation
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Services Showcase */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
            Our Services
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
            Comprehensive solutions tailored to meet your business needs
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {services.map((service, index) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={index}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <CardContent sx={{ textAlign: 'center', pt: 4 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      backgroundColor: 'primary.light',
                      color: 'white',
                      mb: 2,
                    }}
                  >
                    {service.icon}
                  </Box>
                  <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                    {service.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {service.description}
                  </Typography>
                  <Chip
                    label={service.category}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                    {service.price}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  <Button
                    size="medium"
                    variant="outlined"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/services')}
                  >
                    Learn More
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Testimonials */}
      <Box sx={{ bgcolor: 'grey.50', py: 8 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
              What Our Clients Say
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto' }}>
              Don't just take our word for it - hear from our satisfied clients
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {testimonials.map((testimonial, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    textAlign: 'center',
                    p: 3,
                  }}
                >
                  <CardContent>
                    <Avatar
                      sx={{
                        width: 60,
                        height: 60,
                        mx: 'auto',
                        mb: 2,
                        backgroundColor: 'primary.main',
                      }}
                    >
                      {testimonial.avatar}
                    </Avatar>
                    <Rating
                      value={testimonial.rating}
                      readOnly
                      sx={{ mb: 2 }}
                    />
                    <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic' }}>
                      "{testimonial.comment}"
                    </Typography>
                    <Typography variant="h6" component="h4" sx={{ fontWeight: 600 }}>
                      {testimonial.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {testimonial.role}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Contact CTA */}
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
            Ready to Get Started?
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
            Let's discuss how we can help transform your business with our professional services.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 4 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Phone />}
              onClick={() => navigate('/contact')}
            >
              Call Us Now
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Email />}
              onClick={() => navigate('/contact')}
            >
              Send Message
            </Button>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Or email us at info@professionalservices.com
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}

export default HomePage
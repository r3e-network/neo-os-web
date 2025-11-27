import React from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Button, Chip } from '@mui/material';
import {
  Code,
  DesignServices,
  TrendingUp,
  PhoneAndroid,
  Cloud,
  Security,
} from '@mui/icons-material';

const services = [
  {
    id: 1,
    title: 'Web Development',
    description: 'Custom web applications built with modern technologies and best practices.',
    price: 'Starting at $2,500',
    category: 'Development',
    icon: <Code color="primary" sx={{ fontSize: 40 }} />,
    features: ['Responsive Design', 'SEO Optimized', 'Fast Performance', 'Security'],
  },
  {
    id: 2,
    title: 'UI/UX Design',
    description: 'Beautiful and intuitive user interfaces that enhance user experience.',
    price: 'Starting at $1,500',
    category: 'Design',
    icon: <DesignServices color="primary" sx={{ fontSize: 40 }} />,
    features: ['User Research', 'Wireframing', 'Prototyping', 'Design Systems'],
  },
  {
    id: 3,
    title: 'Digital Marketing',
    description: 'Comprehensive digital marketing strategies to grow your online presence.',
    price: 'Starting at $1,000',
    category: 'Marketing',
    icon: <TrendingUp color="primary" sx={{ fontSize: 40 }} />,
    features: ['SEO', 'Social Media', 'Content Marketing', 'Analytics'],
  },
  {
    id: 4,
    title: 'Mobile Development',
    description: 'Native and cross-platform mobile applications for iOS and Android.',
    price: 'Starting at $3,000',
    category: 'Development',
    icon: <PhoneAndroid color="primary" sx={{ fontSize: 40 }} />,
    features: ['iOS & Android', 'Native Performance', 'App Store Ready', 'Maintenance'],
  },
  {
    id: 5,
    title: 'Cloud Solutions',
    description: 'Scalable cloud infrastructure and deployment solutions.',
    price: 'Starting at $800',
    category: 'Infrastructure',
    icon: <Cloud color="primary" sx={{ fontSize: 40 }} />,
    features: ['AWS/Azure', 'Scalability', 'Security', 'Monitoring'],
  },
  {
    id: 6,
    title: 'Security Audit',
    description: 'Comprehensive security assessments and vulnerability testing.',
    price: 'Starting at $1,200',
    category: 'Security',
    icon: <Security color="primary" sx={{ fontSize: 40 }} />,
    features: ['Penetration Testing', 'Code Review', 'Compliance', 'Reporting'],
  },
];

const ServicesPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Our Services
      </Typography>
      
      <Typography variant="body1" paragraph sx={{ mb: 4 }}>
        We offer a comprehensive range of professional services to help your business succeed. 
        From web development to digital marketing, our expert team is ready to bring your vision to life.
      </Typography>

      <Grid container spacing={3}>
        {services.map((service) => (
          <Grid size={{ xs: 12, md: 6 }} key={service.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {service.icon}
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="h6" component="div">
                      {service.title}
                    </Typography>
                    <Chip 
                      label={service.category} 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                    />
                  </Box>
                </Box>
                
                <Typography variant="body2" color="textSecondary" paragraph>
                  {service.description}
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  {service.features.map((feature, index) => (
                    <Chip
                      key={index}
                      label={feature}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                      color="default"
                    />
                  ))}
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" color="primary">
                    {service.price}
                  </Typography>
                  <Button variant="contained" size="small">
                    Learn More
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Ready to Get Started?
        </Typography>
        <Typography variant="body1" paragraph>
          Contact us today to discuss your project requirements and get a personalized quote.
        </Typography>
        <Button variant="contained" color="primary" size="large">
          Contact Us
        </Button>
      </Paper>
    </Box>
  );
};

export default ServicesPage;
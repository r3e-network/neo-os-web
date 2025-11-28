import React from 'react'
import { useParams } from 'react-router-dom'
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material'
import { Check, Phone, Email, ArrowBack } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const ServiceDetailPage: React.FC = () => {
  const { id: _serviceId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Mock service data - in a real app, this would come from API
  const service = {
    title: 'Web Development',
    description: 'Custom web applications built with modern technologies and best practices.',
    category: 'Development',
    price: '$2,500',
    features: [
      'Custom React/Vue.js applications',
      'Node.js backend development',
      'Database design and optimization',
      'RESTful API development',
      'Responsive design implementation',
      'Performance optimization',
      'Security best practices',
      'Deployment and hosting setup',
    ],
    deliverables: [
      'Fully functional web application',
      'Source code with documentation',
      'Database schema and migrations',
      'API documentation',
      'Deployment guide',
      'User manual',
    ],
    timeline: '4-6 weeks',
    support: '30 days free support',
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/services')}
        sx={{ mb: 3 }}
      >
        Back to Services
      </Button>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Chip label={service.category} color="primary" sx={{ mr: 2 }} />
                <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
                  {service.title}
                </Typography>
              </Box>

              <Typography variant="body1" sx={{ mb: 4, fontSize: '1.1rem' }}>
                {service.description}
              </Typography>

              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                What's Included
              </Typography>
              <List dense>
                {service.features.map((feature, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Check color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={feature} />
                  </ListItem>
                ))}
              </List>

              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mt: 3 }}>
                Deliverables
              </Typography>
              <List dense>
                {service.deliverables.map((deliverable, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Check color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={deliverable} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                Pricing
              </Typography>
              <Typography variant="h4" color="primary" sx={{ fontWeight: 700, mb: 2 }}>
                {service.price}
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Timeline:</strong> {service.timeline}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Support:</strong> {service.support}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={<Email />}
                  onClick={() => navigate('/contact')}
                >
                  Request Quote
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  startIcon={<Phone />}
                  onClick={() => navigate('/contact')}
                >
                  Call Now
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  )
}

export default ServiceDetailPage

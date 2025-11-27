import React from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent } from '@mui/material';
import {
  Phone,
  Email,
  LocationOn,
  AccessTime,
} from '@mui/icons-material';

const ContactPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Contact Us
      </Typography>
      
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Get in Touch
            </Typography>
            <Typography variant="body1" paragraph>
              We'd love to hear from you. Whether you have a question about our services, 
              pricing, or anything else, our team is ready to answer all your questions.
            </Typography>
            
            <Grid container spacing={2} sx={{ mt: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Phone color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6">Phone</Typography>
                    <Typography variant="body2" color="textSecondary">
                      +1 (555) 123-4567
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Email color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6">Email</Typography>
                    <Typography variant="body2" color="textSecondary">
                      contact@example.com
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <LocationOn color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6">Address</Typography>
                    <Typography variant="body2" color="textSecondary">
                      123 Business St, City, State 12345
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <AccessTime color="primary" sx={{ mb: 1 }} />
                    <Typography variant="h6">Hours</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Mon-Fri: 9AM-6PM
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Contact
            </Typography>
            <Typography variant="body2" paragraph>
              Fill out the form below and we'll get back to you within 24 hours.
            </Typography>
            {/* Contact form would go here in a real implementation */}
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              Contact form functionality coming soon...
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ContactPage;
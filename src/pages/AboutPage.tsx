import React from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent } from '@mui/material';
import {
  Business,
  Timeline,
  Groups,
  Star,
} from '@mui/icons-material';

const AboutPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        About Us
      </Typography>
      
      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Welcome to Professional Services Platform
        </Typography>
        <Typography variant="body1" paragraph>
          We are a leading provider of professional services, dedicated to helping businesses 
          achieve their goals through innovative solutions and expert consultation. With years 
          of experience in the industry, we have built a reputation for excellence and reliability.
        </Typography>
        <Typography variant="body1" paragraph>
          Our mission is to deliver high-quality services that drive growth and success for our 
          clients. We believe in building long-term partnerships based on trust, transparency, 
          and mutual success.
        </Typography>
      </Paper>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Business color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                50+ Clients
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Trusted by businesses worldwide
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Timeline color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                5+ Years
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Of industry experience
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Groups color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                20+ Experts
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Professional team members
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Star color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                4.9/5 Rating
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Customer satisfaction score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          Our Values
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" color="primary" gutterBottom>
                Excellence
              </Typography>
              <Typography variant="body2">
                We strive for excellence in everything we do, delivering high-quality 
                solutions that exceed expectations.
              </Typography>
            </Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" color="primary" gutterBottom>
                Innovation
              </Typography>
              <Typography variant="body2">
                We embrace innovation and continuously seek new ways to solve 
                problems and create value for our clients.
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" color="primary" gutterBottom>
                Integrity
              </Typography>
              <Typography variant="body2">
                We conduct business with the highest ethical standards, building 
                trust through transparency and honesty.
              </Typography>
            </Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" color="primary" gutterBottom>
                Collaboration
              </Typography>
              <Typography variant="body2">
                We believe in the power of collaboration, working closely with our 
                clients to achieve shared success.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default AboutPage;
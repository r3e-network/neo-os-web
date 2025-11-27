import React from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Divider, Alert, } from '@mui/material';
import { Save } from '@mui/icons-material';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = React.useState({
    siteName: 'Professional Services Platform',
    siteDescription: 'Your trusted partner for professional services',
    contactEmail: 'contact@example.com',
    contactPhone: '+1 (555) 123-4567',
    address: '123 Business St, City, State 12345',
    enableRegistration: true,
    enableContactForm: true,
    enableReviews: true,
    maintenanceMode: false,
    seoTitle: 'Professional Services Platform',
    seoDescription: 'Professional services for your business needs',
    seoKeywords: 'professional, services, business, consulting',
  });

  const [saved, setSaved] = React.useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          General Settings
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Site Name"
              name="siteName"
              value={settings.siteName}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Site Description"
              name="siteDescription"
              value={settings.siteDescription}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Contact Email"
              name="contactEmail"
              type="email"
              value={settings.contactEmail}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Contact Phone"
              name="contactPhone"
              value={settings.contactPhone}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Business Address"
              name="address"
              value={settings.address}
              onChange={handleChange}
              margin="normal"
              multiline
              rows={3}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Feature Settings
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  name="enableRegistration"
                  checked={settings.enableRegistration}
                  onChange={handleChange}
                />
              }
              label="Enable User Registration"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  name="enableContactForm"
                  checked={settings.enableContactForm}
                  onChange={handleChange}
                />
              }
              label="Enable Contact Form"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  name="enableReviews"
                  checked={settings.enableReviews}
                  onChange={handleChange}
                />
              }
              label="Enable Reviews"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  name="maintenanceMode"
                  checked={settings.maintenanceMode}
                  onChange={handleChange}
                />
              }
              label="Maintenance Mode"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          SEO Settings
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="SEO Title"
              name="seoTitle"
              value={settings.seoTitle}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="SEO Description"
              name="seoDescription"
              value={settings.seoDescription}
              onChange={handleChange}
              margin="normal"
              multiline
              rows={3}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="SEO Keywords"
              name="seoKeywords"
              value={settings.seoKeywords}
              onChange={handleChange}
              margin="normal"
              helperText="Separate keywords with commas"
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Save />}
            onClick={handleSave}
            size="large"
          >
            Save Settings
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
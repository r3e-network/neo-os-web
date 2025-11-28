import React, { useState } from 'react'
import { Box, Typography, Card, CardContent, TextField, Button, Grid, Avatar, Alert, } from '@mui/material'
import { PhotoCamera, Save } from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'

const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    company: '',
    address: '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    })
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess(false)
    setLoading(true)

    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      setSuccess(true)
    }, 2000)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess(false)

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      alert('New password must be at least 6 characters long')
      return
    }

    setLoading(true)

    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      setSuccess(true)
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    }, 2000)
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Profile Settings
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Profile updated successfully!
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                Personal Information
              </Typography>

              <Box component="form" onSubmit={handleProfileSubmit}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      required
                      fullWidth
                      label="Full Name"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      required
                      fullWidth
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleProfileChange}
                      disabled
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phone"
                      value={formData.phone}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Company"
                      name="company"
                      value={formData.company}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Address"
                      name="address"
                      value={formData.address}
                      onChange={handleProfileChange}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<Save />}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ textAlign: 'center', p: 4 }}>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  mx: 'auto',
                  mb: 2,
                  backgroundColor: 'primary.main',
                  fontSize: 32,
                }}
              >
                {formData.fullName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h6" gutterBottom>
                {formData.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formData.email}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                sx={{ mt: 2 }}
                fullWidth
              >
                Change Photo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                Change Password
              </Typography>

              <Box component="form" onSubmit={handlePasswordSubmit}>
                <TextField
                  fullWidth
                  type="password"
                  label="Current Password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="New Password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  sx={{ mb: 2 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ProfilePage

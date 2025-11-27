import React, { useState } from 'react'
import { Box, Typography, Card, CardContent, Button, TextField, Grid, List, ListItem, ListItemText, ListItemButton, Dialog, DialogTitle, DialogContent, DialogActions, Chip, IconButton, } from '@mui/material'
import {
  Add,
  Edit,
  Delete,
  Save,
  Image,
} from '@mui/icons-material'

const ContentManagementPage: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState('hero')
  const [editDialog, setEditDialog] = useState(false)
  const [editData, setEditData] = useState({ title: '', content: '' })

  const contentSections = [
    { id: 'hero', name: 'Hero Section', type: 'banner', status: 'active' },
    { id: 'services', name: 'Services Showcase', type: 'services', status: 'active' },
    { id: 'testimonials', name: 'Testimonials', type: 'reviews', status: 'active' },
    { id: 'about', name: 'About Us', type: 'content', status: 'active' },
    { id: 'team', name: 'Team Members', type: 'team', status: 'draft' },
  ]

  const services = [
    {
      id: 1,
      name: 'Web Development',
      description: 'Custom web applications built with modern technologies',
      price: '$2,500',
      category: 'Development',
      status: 'active',
    },
    {
      id: 2,
      name: 'UI/UX Design',
      description: 'Beautiful and intuitive user interfaces',
      price: '$1,500',
      category: 'Design',
      status: 'active',
    },
    {
      id: 3,
      name: 'Data Analytics',
      description: 'Transform your data into actionable insights',
      price: '$3,000',
      category: 'Analytics',
      status: 'draft',
    },
  ]

  const handleEdit = (section: any) => {
    setEditData({ title: section.name, content: section.description || '' })
    setEditDialog(true)
  }

  const handleSave = () => {
    // Save content changes
    setEditDialog(false)
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Content Management
      </Typography>

      <Grid container spacing={3}>
        {/* Content Sections */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Website Sections
              </Typography>
              <List>
                {contentSections.map((section) => (
                  <ListItem key={section.id} disablePadding>
                    <ListItemButton
                      selected={selectedSection === section.id}
                      onClick={() => setSelectedSection(section.id)}
                    >
                      <ListItemText
                        primary={section.name}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Chip label={section.type} size="small" variant="outlined" />
                            <Chip
                              label={section.status}
                              size="small"
                              color={section.status === 'active' ? 'success' : 'default'}
                            />
                          </Box>
                        }
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(section)
                        }}
                      >
                        <Edit />
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Content Editor */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Edit {selectedSection} Section
              </Typography>
              
              {selectedSection === 'hero' && (
                <Box>
                  <TextField
                    fullWidth
                    label="Hero Title"
                    defaultValue="Transform Your Business with Professional Services"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Hero Description"
                    defaultValue="We deliver cutting-edge solutions that drive growth, enhance efficiency, and create exceptional user experiences."
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Call to Action Text"
                    defaultValue="Get Started"
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<Image />}
                    sx={{ mb: 2 }}
                  >
                    Upload Background Image
                  </Button>
                </Box>
              )}

              {selectedSection === 'services' && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Services List</Typography>
                    <Button variant="outlined" startIcon={<Add />}>
                      Add Service
                    </Button>
                  </Box>
                  {services.map((service) => (
                    <Card key={service.id} sx={{ mb: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <Box>
                            <Typography variant="h6">{service.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {service.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                              <Chip label={service.category} size="small" />
                              <Chip
                                label={service.price}
                                size="small"
                                color="primary"
                              />
                              <Chip
                                label={service.status}
                                size="small"
                                color={service.status === 'active' ? 'success' : 'default'}
                              />
                            </Box>
                          </Box>
                          <Box>
                            <IconButton size="small">
                              <Edit />
                            </IconButton>
                            <IconButton size="small" color="error">
                              <Delete />
                            </IconButton>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}

              {selectedSection === 'testimonials' && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Customer Testimonials
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Testimonial Content"
                    defaultValue="Exceptional service and outstanding results. The team delivered exactly what we needed on time and within budget."
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Customer Name"
                    defaultValue="Sarah Johnson"
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Customer Role"
                    defaultValue="CEO, TechStart Inc."
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Rating"
                    defaultValue="5"
                    type="number"
                    inputProps={{ min: 1, max: 5 }}
                    sx={{ mb: 2 }}
                  />
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button variant="contained" startIcon={<Save />}>
                  Save Changes
                </Button>
                <Button variant="outlined" color="error">
                  Reset to Default
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Content</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            fullWidth
            variant="outlined"
            value={editData.title}
            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Content"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={editData.content}
            onChange={(e) => setEditData({ ...editData, content: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" startIcon={<Save />}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ContentManagementPage
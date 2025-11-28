import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from '@mui/material'
import {
  Person,
  History,
  ContactSupport,
  Dashboard as DashboardIcon,
} from '@mui/icons-material'

const drawerWidth = 240

const UserDashboard: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
    { label: 'Profile', path: '/dashboard/profile', icon: <Person /> },
    { label: 'Order History', path: '/dashboard/orders', icon: <History /> },
    { label: 'Support Tickets', path: '/dashboard/tickets', icon: <ContactSupport /> },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  selected={isActive(item.path)}
                  onClick={() => navigate(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}

export default UserDashboard

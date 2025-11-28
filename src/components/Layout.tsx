import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material'
import { Menu as MenuIcon, Business } from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'

const Layout: React.FC = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [mobileMenuAnchor, setMobileMenuAnchor] = React.useState<null | HTMLElement>(null)

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMobileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setMobileMenuAnchor(null)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/')
    handleClose()
  }

  const isActive = (path: string) => location.pathname === path

  const menuItems = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Services', path: '/services' },
    { label: 'Contact', path: '/contact' },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2, display: { md: 'none' } }}
            onClick={handleMobileMenu}
          >
            <MenuIcon />
          </IconButton>
          
          <Business sx={{ mr: 1 }} />
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            Professional Services
          </Typography>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                onClick={() => navigate(item.path)}
                sx={{
                  backgroundColor: isActive(item.path) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {user ? (
              <>
                <Button
                  color="inherit"
                  onClick={() => navigate('/dashboard')}
                  sx={{ textTransform: 'none' }}
                >
                  Dashboard
                </Button>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {user.email?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                >
                  <MenuItem onClick={() => { navigate('/dashboard'); handleClose(); }}>
                    Profile
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>Logout</MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button
                  color="inherit"
                  onClick={() => navigate('/login')}
                  sx={{ textTransform: 'none' }}
                >
                  Login
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => navigate('/register')}
                  sx={{ textTransform: 'none' }}
                >
                  Register
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile menu */}
      <Menu
        id="mobile-menu"
        anchorEl={mobileMenuAnchor}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleClose}
      >
        {menuItems.map((item) => (
          <MenuItem
            key={item.path}
            onClick={() => { navigate(item.path); handleClose(); }}
            sx={{
              backgroundColor: isActive(item.path) ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Main content */}
      <Container component="main" sx={{ flex: 1, py: 4 }}>
        <Outlet />
      </Container>

      {/* Footer */}
      <Box component="footer" sx={{ bgcolor: 'grey.100', py: 6, mt: 'auto' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} Professional Services. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}

export default Layout

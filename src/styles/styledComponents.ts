import { styled } from '@mui/material/styles';
import { 
  Card, 
  Button, 
  Chip, 
  Box, 
  Typography,
  Paper,
  AppBar as MuiAppBar,
  Toolbar as MuiToolbar
} from '@mui/material';

// Professional Card with beautiful styling
export const ProfessionalCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  overflow: 'hidden',
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
  border: `1px solid ${theme.palette.grey[200]}`,
  '&:hover': {
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.16)',
    transform: 'translateY(-4px)',
    borderColor: theme.palette.primary[300],
  },
}));

// Gradient Button with modern styling
export const GradientButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary[500]} 0%, ${theme.palette.primary[600]} 100%)`,
  color: 'white',
  borderRadius: 16,
  padding: '12px 24px',
  fontWeight: 600,
  fontSize: '0.875rem',
  textTransform: 'none',
  boxShadow: '0 4px 16px rgba(33, 150, 243, 0.3)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.palette.primary[600]} 0%, ${theme.palette.primary[700]} 100%)`,
    boxShadow: '0 8px 24px rgba(33, 150, 243, 0.4)',
    transform: 'translateY(-2px)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
}));

// Modern Chip with subtle styling
export const ModernChip = styled(Chip)(({ theme }) => ({
  borderRadius: 24,
  fontWeight: 600,
  fontSize: '0.75rem',
  padding: '6px 12px',
  background: `linear-gradient(135deg, ${theme.palette.grey[100]} 0%, ${theme.palette.background.paper} 100%)`,
  border: `1px solid ${theme.palette.grey[200]}`,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
    transform: 'translateY(-1px)',
  },
}));

// Glassmorphism Container
export const GlassContainer = styled(Paper)(() => ({
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(20px)',
  borderRadius: 24,
  border: `1px solid rgba(255, 255, 255, 0.3)`,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15)',
    transform: 'translateY(-2px)',
  },
}));

// Professional AppBar
export const ProfessionalAppBar = styled(MuiAppBar)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary[600]} 0%, ${theme.palette.primary[800]} 100%)`,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  backdropFilter: 'blur(10px)',
  borderBottom: `1px solid rgba(255, 255, 255, 0.1)`,
}));

// Modern Toolbar
export const ModernToolbar = styled(MuiToolbar)(() => ({
  padding: '16px 24px',
  minHeight: 80,
}));

// Gradient Background Container
export const GradientContainer = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary[50]} 0%, ${theme.palette.secondary[50]} 50%, ${theme.palette.info[50]} 100%)`,
  minHeight: '100vh',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `radial-gradient(circle at 20% 80%, ${theme.palette.primary[100]} 0%, transparent 50%),
                 radial-gradient(circle at 80% 20%, ${theme.palette.secondary[100]} 0%, transparent 50%)`,
    opacity: 0.6,
  },
}));

// Modern Typography variants
export const Heading1 = styled(Typography)(({ theme }) => ({
  fontSize: '3rem',
  fontWeight: 800,
  background: `linear-gradient(135deg, ${theme.palette.primary[600]} 0%, ${theme.palette.secondary[600]} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  textFillColor: 'transparent',
  marginBottom: theme.spacing(3),
}));

export const Heading2 = styled(Typography)(({ theme }) => ({
  fontSize: '2.25rem',
  fontWeight: 700,
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(2),
}));

export const Subtitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.125rem',
  fontWeight: 500,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(3),
}));

// Animated Card with hover effects
export const AnimatedCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(135deg, ${theme.palette.primary[50]} 0%, ${theme.palette.secondary[50]} 100%)`,
    opacity: 0,
    transition: 'opacity 0.4s ease',
    zIndex: 0,
  },
  '&:hover': {
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15)',
    transform: 'translateY(-8px)',
    '&::before': {
      opacity: 0.3,
    },
  },
}));

// Status Card with gradient background
type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default'

export const StatusCard = styled(Card, {
  // Avoid forwarding the synthetic status prop to the DOM
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status?: StatusVariant }>(({ theme, status = 'default' }) => {
  const statusColors = {
    success: `linear-gradient(135deg, ${theme.palette.success[50]} 0%, ${theme.palette.success[100]} 100%)`,
    warning: `linear-gradient(135deg, ${theme.palette.warning[50]} 0%, ${theme.palette.warning[100]} 100%)`,
    error: `linear-gradient(135deg, ${theme.palette.error[50]} 0%, ${theme.palette.error[100]} 100%)`,
    info: `linear-gradient(135deg, ${theme.palette.info[50]} 0%, ${theme.palette.info[100]} 100%)`,
    default: `linear-gradient(135deg, ${theme.palette.grey[50]} 0%, ${theme.palette.grey[100]} 100%)`,
  };
  
  const borderColors = {
    success: theme.palette.success[200],
    warning: theme.palette.warning[200],
    error: theme.palette.error[200],
    info: theme.palette.info[200],
    default: theme.palette.grey[200],
  };
  
  return {
    background: statusColors[status],
    border: `1px solid ${borderColors[status]}`,
    borderRadius: 16,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
    transition: 'all 0.3s ease',
    '&:hover': {
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      transform: 'translateY(-2px)',
    },
  };
});

// Modern Badge
export const ModernBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 12px',
  borderRadius: 20,
  fontSize: '0.75rem',
  fontWeight: 600,
  background: `linear-gradient(135deg, ${theme.palette.primary[100]} 0%, ${theme.palette.primary[200]} 100%)`,
  color: theme.palette.primary[800],
  border: `1px solid ${theme.palette.primary[300]}`,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
}));

// Floating Action Button
export const FloatingActionButton = styled(Button)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(4),
  right: theme.spacing(4),
  background: `linear-gradient(135deg, ${theme.palette.secondary[500]} 0%, ${theme.palette.secondary[600]} 100%)`,
  color: 'white',
  borderRadius: '50%',
  width: 64,
  height: 64,
  boxShadow: '0 8px 24px rgba(156, 39, 176, 0.3)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.palette.secondary[600]} 0%, ${theme.palette.secondary[700]} 100%)`,
    boxShadow: '0 12px 32px rgba(156, 39, 176, 0.4)',
    transform: 'scale(1.1)',
  },
}));

export default {
  ProfessionalCard,
  GradientButton,
  ModernChip,
  GlassContainer,
  ProfessionalAppBar,
  ModernToolbar,
  GradientContainer,
  Heading1,
  Heading2,
  Subtitle,
  AnimatedCard,
  StatusCard,
  ModernBadge,
  FloatingActionButton,
};

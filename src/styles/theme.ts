import { createTheme } from '@mui/material/styles';

// Professional Color Palette
const colors = {
  // Primary Colors - Modern Blue Gradient
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3', // Main primary
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
    main: '#2196f3',
    light: '#64b5f6',
    dark: '#1565c0',
  },
  
  // Secondary Colors - Sophisticated Purple
  secondary: {
    50: '#f3e5f5',
    100: '#e1bee7',
    200: '#ce93d8',
    300: '#ba68c8',
    400: '#ab47bc',
    500: '#9c27b0', // Main secondary
    600: '#8e24aa',
    700: '#7b1fa2',
    800: '#6a1b9a',
    900: '#4a148c',
    main: '#9c27b0',
    light: '#ba68c8',
    dark: '#7b1fa2',
  },
  
  // Neutral Colors - Professional Grays
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
  
  // Success Colors - Vibrant Green
  success: {
    50: '#e8f5e8',
    100: '#c8e6c9',
    200: '#a5d6a7',
    300: '#81c784',
    400: '#66bb6a',
    500: '#4caf50', // Main success
    600: '#43a047',
    700: '#388e3c',
    800: '#2e7d32',
    900: '#1b5e20',
    main: '#4caf50',
    light: '#81c784',
    dark: '#388e3c',
  },
  
  // Warning Colors - Warm Orange
  warning: {
    50: '#fff3e0',
    100: '#ffe0b2',
    200: '#ffcc80',
    300: '#ffb74d',
    400: '#ffa726',
    500: '#ff9800', // Main warning
    600: '#fb8c00',
    700: '#f57c00',
    800: '#ef6c00',
    900: '#e65100',
    main: '#ff9800',
    light: '#ffb74d',
    dark: '#f57c00',
  },
  
  // Error Colors - Modern Red
  error: {
    50: '#ffebee',
    100: '#ffcdd2',
    200: '#ef9a9a',
    300: '#e57373',
    400: '#ef5350',
    500: '#f44336', // Main error
    600: '#e53935',
    700: '#d32f2f',
    800: '#c62828',
    900: '#b71c1c',
    main: '#f44336',
    light: '#ef5350',
    dark: '#d32f2f',
  },
  
  // Info Colors - Cool Cyan
  info: {
    50: '#e0f7fa',
    100: '#b2ebf2',
    200: '#80deea',
    300: '#4dd0e1',
    400: '#26c6da',
    500: '#00bcd4', // Main info
    600: '#00acc1',
    700: '#0097a7',
    800: '#00838f',
    900: '#006064',
    main: '#00bcd4',
    light: '#4dd0e1',
    dark: '#0097a7',
  },
};

// Professional Typography System
const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  
  // Headings - Modern and Bold
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.005em',
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '-0.005em',
  },
  h6: {
    fontSize: '1.125rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0em',
  },
  
  // Body Text - Clean and Readable
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
  
  // Subtitle - Elegant
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.005em',
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.005em',
  },
  
  // Button - Modern and Bold
  button: {
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.75,
    letterSpacing: '0.02em',
    textTransform: 'none',
  },
  
  // Caption - Subtle
  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.02em',
  },
  
  // Overline - Distinctive
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
};

// Professional Component Overrides
const componentOverrides = {
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
          transform: 'translateY(-2px)',
        },
      },
    },
  },
  
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
        padding: '10px 20px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      },
      contained: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        '&:hover': {
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
        },
      },
      outlined: {
        borderWidth: 2,
        '&:hover': {
          borderWidth: 2,
        },
      },
    },
  },
  
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 20,
        fontWeight: 600,
        fontSize: '0.75rem',
        padding: '4px 8px',
      },
      filled: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 12,
          transition: 'all 0.3s ease',
          '& fieldset': {
            borderColor: colors.neutral[300],
          },
          '&:hover fieldset': {
            borderColor: colors.primary[400],
          },
          '&.Mui-focused fieldset': {
            borderColor: colors.primary[500],
            borderWidth: 2,
          },
        },
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      },
      elevation1: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      elevation2: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      },
      elevation3: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  
  MuiTabs: {
    styleOverrides: {
      root: {
        minHeight: 48,
      },
      indicator: {
        height: 3,
        borderRadius: '3px 3px 0 0',
      },
    },
  },
  
  MuiTab: {
    styleOverrides: {
      root: {
        minHeight: 48,
        fontWeight: 600,
        fontSize: '0.875rem',
        textTransform: 'none',
        borderRadius: '8px 8px 0 0',
        marginRight: 4,
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(33, 150, 243, 0.08)',
        },
      },
    },
  },
  
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 20,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  
  MuiListItem: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        marginBottom: 4,
        '&:hover': {
          backgroundColor: 'rgba(33, 150, 243, 0.08)',
        },
      },
    },
  },
  
  MuiAvatar: {
    styleOverrides: {
      root: {
        borderRadius: 12,
      },
    },
  },
  
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(33, 150, 243, 0.08)',
          transform: 'scale(1.1)',
        },
      },
    },
  },
};

// Create the professional theme
export const professionalTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.primary[500],
      light: colors.primary[300],
      dark: colors.primary[700],
      50: colors.primary[50],
      100: colors.primary[100],
      200: colors.primary[200],
      300: colors.primary[300],
      400: colors.primary[400],
      500: colors.primary[500],
      600: colors.primary[600],
      700: colors.primary[700],
      800: colors.primary[800],
      900: colors.primary[900],
    },
    secondary: {
      main: colors.secondary[500],
      light: colors.secondary[300],
      dark: colors.secondary[700],
      50: colors.secondary[50],
      100: colors.secondary[100],
      200: colors.secondary[200],
      300: colors.secondary[300],
      400: colors.secondary[400],
      500: colors.secondary[500],
      600: colors.secondary[600],
      700: colors.secondary[700],
      800: colors.secondary[800],
      900: colors.secondary[900],
    },
    success: {
      main: colors.success[500],
      light: colors.success[300],
      dark: colors.success[700],
    },
    warning: {
      main: colors.warning[500],
      light: colors.warning[300],
      dark: colors.warning[700],
    },
    error: {
      main: colors.error[500],
      light: colors.error[300],
      dark: colors.error[700],
    },
    info: {
      main: colors.info[500],
      light: colors.info[300],
      dark: colors.info[700],
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: colors.neutral[900],
      secondary: colors.neutral[600],
      disabled: colors.neutral[400],
    },
    grey: colors.neutral,
  },
  typography,
  shape: {
    borderRadius: 12,
  },
  spacing: 8, // 8px base spacing unit
  components: componentOverrides,
});

// Dark theme variant
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary[400],
      light: colors.primary[300],
      dark: colors.primary[600],
    },
    secondary: {
      main: colors.secondary[400],
      light: colors.secondary[300],
      dark: colors.secondary[600],
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.5)',
    },
  },
  typography,
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  components: componentOverrides,
});

export default professionalTheme;

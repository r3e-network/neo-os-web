import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: '#e0f5ff',
    100: '#b8e6ff',
    200: '#8cd6ff',
    300: '#5ec5ff',
    400: '#36b5ff',
    500: '#1fa5fe',
    600: '#0082d4',
    700: '#006091',
    800: '#003d5e',
    900: '#001c2c',
  },
  accent: {
    50: '#f2e4ff',
    100: '#d4b4ff',
    200: '#b583fb',
    300: '#9652f7',
    400: '#7823f3',
    500: '#5e09da',
    600: '#4906aa',
    700: '#34037b',
    800: '#20014c',
    900: '#0d001e',
  },
};

const fonts = {
  heading: '"Poppins", sans-serif',
  body: '"Inter", sans-serif',
};

const components = {
  Button: {
    baseStyle: {
      fontWeight: 'bold',
      borderRadius: 'md',
    },
    variants: {
      solid: (props) => ({
        bg: props.colorMode === 'dark' ? 'brand.500' : 'brand.500',
        color: 'white',
        _hover: {
          bg: props.colorMode === 'dark' ? 'brand.400' : 'brand.600',
        },
      }),
      outline: (props) => ({
        borderColor: props.colorMode === 'dark' ? 'brand.500' : 'brand.500',
        color: props.colorMode === 'dark' ? 'brand.500' : 'brand.500',
      }),
    },
  },
  Card: {
    baseStyle: (props) => ({
      container: {
        backgroundColor: props.colorMode === 'dark' ? 'gray.700' : 'white',
        borderRadius: 'lg',
        boxShadow: 'md',
      },
    }),
  },
};

const theme = extendTheme({ config, colors, fonts, components });

export default theme; 
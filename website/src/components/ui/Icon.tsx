import React from 'react';

// Define common icons that we'll use throughout the application
const icons = {
  arrowRight: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  arrowLeft: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  plus: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  check: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  close: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  github: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017C2 16.442 4.865 20.197 8.839 21.521C9.339 21.613 9.521 21.304 9.521 21.038C9.521 20.801 9.513 20.046 9.508 19.194C6.726 19.799 6.139 17.851 6.139 17.851C5.685 16.693 5.029 16.385 5.029 16.385C4.121 15.765 5.098 15.778 5.098 15.778C6.101 15.849 6.632 16.811 6.632 16.811C7.524 18.341 8.973 17.898 9.542 17.642C9.634 16.995 9.884 16.554 10.157 16.295C7.94 16.033 5.61 15.154 5.61 11.249C5.61 10.156 6.001 9.262 6.652 8.561C6.548 8.307 6.204 7.286 6.752 5.969C6.752 5.969 7.59 5.698 9.497 6.93C10.3133 6.71027 11.1551 6.59966 12 6.601C12.845 6.601 13.7 6.711 14.503 6.93C16.41 5.698 17.247 5.969 17.247 5.969C17.795 7.286 17.452 8.307 17.347 8.561C17.999 9.262 18.388 10.156 18.388 11.249C18.388 15.164 16.055 16.03 13.83 16.287C14.172 16.61 14.482 17.249 14.482 18.23C14.482 19.647 14.471 20.709 14.471 21.038C14.471 21.306 14.649 21.618 15.161 21.52C19.134 20.194 22 16.442 22 12.017C22 6.484 17.522 2 12 2Z" fill="currentColor"/>
    </svg>
  ),
  twitter: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.29 20.251C17.837 20.251 22.965 12.491 22.965 5.835C22.965 5.657 22.965 5.48 22.953 5.303C23.9625 4.568 24.837 3.656 25.5 2.613C24.5575 3.044 23.5514 3.333 22.5 3.47C23.6196 2.8173 24.4637 1.789 24.866 0.574C23.8458 1.18566 22.7257 1.62404 21.56 1.87C20.7354 0.984418 19.6595 0.382191 18.482 0.153348C17.3044 -0.0754946 16.0849 0.0775144 15.0003 0.589833C13.9158 1.10215 13.0232 1.94859 12.4723 2.99697C11.9214 4.04536 11.7413 5.24273 11.96 6.39C9.97447 6.28455 8.03014 5.76318 6.26625 4.85943C4.50235 3.95568 2.95639 2.68794 1.732 1.151C1.078 2.327 0.874 3.724 1.157 5.055C1.44 6.387 2.189 7.559 3.264 8.329C2.46317 8.30473 1.67961 8.08329 0.978 7.683V7.747C0.977862 8.94616 1.378 10.1098 2.11918 11.0488C2.86035 11.9878 3.88471 12.6454 5.032 12.907C4.29073 13.1157 3.51213 13.1464 2.757 13.007C3.08 14.0406 3.71716 14.947 4.58375 15.599C5.45034 16.2509 6.50445 16.6187 7.59 16.648C6.50758 17.5082 5.24551 18.1408 3.89287 18.5172C2.54024 18.8936 1.12752 19.0061 0.731 18.948C3.12671 20.457 5.91572 21.2557 8.758 21.251C8.29 20.251 8.29 20.251 8.29 20.251Z" fill="currentColor"/>
    </svg>
  ),
  discord: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3847-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" fill="currentColor"/>
    </svg>
  ),
  search: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  menu: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

type IconName = keyof typeof icons;
type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
}

export default function Icon({ name, size = 'md', className = '' }: IconProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };
  
  return (
    <span className={`inline-flex ${sizeClasses[size]} ${className}`}>
      {icons[name]}
    </span>
  );
} 
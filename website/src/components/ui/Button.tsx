import React from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  className?: string;
  rounded?: boolean;
  fullWidth?: boolean;
  withIcon?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  className = '',
  rounded = false,
  fullWidth = false,
  withIcon = false,
  onClick,
  type = 'button',
  disabled = false,
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-300';
  
  const variantStyles = {
    primary: 'bg-primary text-secondary hover:bg-primary/90 shadow-md hover:shadow-lg',
    secondary: 'bg-secondary text-white hover:bg-secondary/90 shadow-md hover:shadow-lg',
    accent: 'bg-accent text-white hover:bg-accent/90 shadow-md hover:shadow-lg',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white shadow-sm hover:shadow-md',
    ghost: 'text-secondary hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800',
  };
  
  const sizeStyles = {
    sm: 'text-sm px-3 py-1.5',
    md: 'px-6 py-3',
    lg: 'text-lg px-8 py-4',
  };
  
  const roundedStyles = rounded ? 'rounded-full' : 'rounded-md';
  const widthStyles = fullWidth ? 'w-full' : '';
  const iconStyles = withIcon ? 'space-x-2' : '';
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';
  
  const computedClasses = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${roundedStyles} ${widthStyles} ${iconStyles} ${disabledStyles} ${className}`;
  
  if (href) {
    return (
      <Link href={href} className={computedClasses}>
        {children}
      </Link>
    );
  }
  
  return (
    <button 
      type={type} 
      className={computedClasses} 
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
} 
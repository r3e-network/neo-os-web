import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  bordered?: boolean;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function Card({
  children,
  className = '',
  hover = true,
  bordered = false,
  shadow = 'md',
}: CardProps) {
  const baseStyles = 'bg-white rounded-xl overflow-hidden';
  
  const hoverStyles = hover ? 'transition-all duration-300 hover:shadow-xl' : '';
  
  const borderStyles = bordered ? 'border border-gray-100' : '';
  
  const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  };
  
  return (
    <div className={`${baseStyles} ${hoverStyles} ${borderStyles} ${shadowStyles[shadow]} ${className}`}>
      {children}
    </div>
  );
}

// Card subcomponents for consistent usage patterns
Card.Header = function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 border-b border-gray-100 ${className}`}>{children}</div>;
};

Card.Body = function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 border-t border-gray-100 ${className}`}>{children}</div>;
}; 
/**
 * Card Component - Enhanced with design system tokens
 * Supports various layouts, states, and interactive features
 */

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "elevated" | "outlined" | "ghost" | "glass";
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card visual variant */
  variant?: CardVariant;
  /** Card padding size */
  padding?: CardPadding;
  /** Whether the card is interactive (clickable) */
  interactive?: boolean;
  /** Whether to show hover effects */
  hoverable?: boolean;
  /** Card border radius */
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
}

// ============================================================================
// Variant Styles
// ============================================================================

const variantStyles: Record<CardVariant, string> = {
  default: "bg-gray-900/80 border border-gray-800",
  elevated: "bg-gray-900 shadow-lg shadow-black/20",
  outlined: "bg-transparent border-2 border-gray-700",
  ghost: "bg-transparent",
  glass: "bg-gray-900/60 backdrop-blur-md border border-white/10",
};

// ============================================================================
// Padding Styles
// ============================================================================

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
};

// ============================================================================
// Rounded Styles
// ============================================================================

const roundedStyles: Record<CardProps["rounded"], string> = {
  none: "rounded-none",
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
  full: "rounded-full",
};

// ============================================================================
// Card Component
// ============================================================================

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "default",
      padding = "md",
      hoverable = false,
      interactive = false,
      rounded = "lg",
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          "transition-all duration-200",
          // Variant
          variantStyles[variant],
          // Padding
          paddingStyles[padding],
          // Rounded
          roundedStyles[rounded],
          // Interactive/Hoverable
          (interactive || hoverable) &&
            "cursor-pointer hover:border-gray-600 hover:shadow-lg",
          interactive && "focus:outline-none focus-visible:ring-2 focus-visible:ring-neo focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// ============================================================================
// Card Header
// ============================================================================

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Title alignment */
  align?: "left" | "center" | "right";
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ align = "left", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-1 mb-4",
          align === "center" && "items-center text-center",
          align === "right" && "items-end text-right",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = "CardHeader";

// ============================================================================
// Card Title
// ============================================================================

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Title level */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Tag = "h3", className, children, ...props }, ref) => {
    return (
      <Tag
        ref={ref}
        className={cn(
          "text-xl font-semibold text-white",
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);

CardTitle.displayName = "CardTitle";

// ============================================================================
// Card Description
// ============================================================================

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-sm text-gray-400", className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = "CardDescription";

// ============================================================================
// Card Content
// ============================================================================

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(className)} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = "CardContent";

// ============================================================================
// Card Footer
// ============================================================================

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Footer alignment */
  align?: "left" | "center" | "right" | "between";
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ align = "left", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 mt-4 pt-4 border-t border-gray-800",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
          align === "between" && "justify-between",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = "CardFooter";

// ============================================================================
// Card Media (Image/Video)
// ============================================================================

export interface CardMediaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Media aspect ratio */
  aspectRatio?: "auto" | "square" | "video" | "wide";
}

const aspectRatioStyles: Record<CardMediaProps["aspectRatio"], string> = {
  auto: "",
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[2/1]",
};

export const CardMedia = forwardRef<HTMLDivElement, CardMediaProps>(
  ({ aspectRatio = "auto", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden",
          aspectRatioStyles[aspectRatio],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardMedia.displayName = "CardMedia";

// ============================================================================
// Card Actions (for buttons in footer)
// ============================================================================

export interface CardActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Actions alignment */
  align?: "left" | "center" | "right" | "full";
}

export const CardActions = forwardRef<HTMLDivElement, CardActionsProps>(
  ({ align = "right", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
          align === "left" && "justify-start",
          align === "full" && "w-full [&>button]:flex-1",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardActions.displayName = "CardActions";

// ============================================================================
// Card Badge
// ============================================================================

export interface CardBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: "default" | "success" | "warning" | "error" | "info";
}

const badgeVariantStyles: Record<CardBadgeProps["variant"], string> = {
  default: "bg-gray-700 text-gray-300",
  success: "bg-emerald-500/20 text-emerald-400",
  warning: "bg-amber-500/20 text-amber-400",
  error: "bg-red-500/20 text-red-400",
  info: "bg-blue-500/20 text-blue-400",
};

export const CardBadge = forwardRef<HTMLSpanElement, CardBadgeProps>(
  ({ variant = "default", className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
          badgeVariantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

CardBadge.displayName = "CardBadge";

// ============================================================================
// Composite Card (Complete Card with all parts)
// ============================================================================

export interface CompositeCardProps extends CardProps {
  /** Card header content */
  header?: React.ReactNode;
  /** Card title */
  title?: React.ReactNode;
  /** Card description */
  description?: React.ReactNode;
  /** Card media (image/video) */
  media?: React.ReactNode;
  /** Card body content */
  content?: React.ReactNode;
  /** Card footer actions */
  footer?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
}

export const CompositeCard: React.FC<CompositeCardProps> = ({
  title,
  description,
  media,
  header,
  content,
  footer,
  onClick,
  ...props
}) => {
  return (
    <Card interactive={!!onClick} onClick={onClick} {...props}>
      {media && <CardMedia>{media}</CardMedia>}
      
      {(header || title || description) && (
        <CardHeader>
          {header}
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      
      {content && <CardContent>{content}</CardContent>}
      
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
};

export default Card;

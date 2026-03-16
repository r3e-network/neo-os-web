/**
 * UI Components Library
 * 
 * Reusable UI components built with the design system tokens
 * and accessibility features.
 */

// ============================================================================
// Core Components
// ============================================================================

export { Button, IconButton, ButtonGroup } from "./button";
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps } from "./button";

export { Input, Textarea } from "./input";
export type { InputProps, InputSize, InputVariant, TextareaProps } from "./input";

export { Select } from "./select";
export type { SelectProps, SelectOption, SelectSize, SelectVariant } from "./select";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardMedia, CardBadge, CompositeCard } from "./card";
export type { CardProps, CardVariant, CardPadding, CardHeaderProps, CardTitleProps, CardDescriptionProps, CardContentProps, CardFooterProps, CardMediaProps, CardBadgeProps, CompositeCardProps } from "./card";

export { Modal, ConfirmModal } from "./modal";
export type { ModalProps, ModalSize, ModalAnimation, ConfirmModalProps } from "./modal";

export { Drawer, Sheet } from "./drawer";
export type { DrawerProps, DrawerPosition, DrawerSize, SheetProps } from "./drawer";

export { ToastProvider, useToast, StandaloneToast } from "./toast";
export type { Toast, ToastType, ToastPosition, ToastContextValue } from "./toast";

export { Alert, AlertLink, AlertButton, AlertTitle, AlertDescription } from "./alert";
export type { AlertProps, AlertVariant, AlertLinkProps, AlertButtonProps } from "./alert";

// ============================================================================
// Re-export design system utilities
// ============================================================================

export * from "@/lib/design-system";

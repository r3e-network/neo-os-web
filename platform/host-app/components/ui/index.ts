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

export { Select } from "./Select";
export type { SelectProps, SelectOption, SelectSize, SelectVariant } from "./Select";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardMedia, CardBadge, CompositeCard } from "./card";
export type { CardProps, CardVariant, CardPadding, CardHeaderProps, CardTitleProps, CardDescriptionProps, CardContentProps, CardFooterProps, CardMediaProps, CardBadgeProps, CompositeCardProps } from "./card";

export { Modal, ConfirmModal } from "./Modal";
export type { ModalProps, ModalSize, ModalAnimation, ConfirmModalProps } from "./Modal";

export { Drawer, Sheet } from "./Drawer";
export type { DrawerProps, DrawerPosition, DrawerSize, SheetProps } from "./Drawer";

export { ToastProvider, useToast, StandaloneToast } from "./Toast";
export type { Toast, ToastType, ToastPosition, ToastContextValue } from "./Toast";

export { Alert, AlertLink, AlertButton, AlertTitle, AlertDescription } from "./Alert";
export type { AlertProps, AlertVariant, AlertLinkProps, AlertButtonProps } from "./Alert";

// ============================================================================
// Re-export design system utilities
// ============================================================================

export * from "@/lib/design-system";

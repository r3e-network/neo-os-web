/**
 * UI Components Library
 * 
 * Reusable UI components built with the design system tokens
 * and accessibility features.
 */

// ============================================================================
// Core Components
// ============================================================================

export { Button, IconButton, ButtonGroup } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps } from "./Button";

export { Input, Textarea } from "./Input";
export type { InputProps, InputSize, InputVariant, TextareaProps } from "./Input";

export { Select } from "./Select";
export type { SelectProps, SelectOption, SelectSize, SelectVariant } from "./Select";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardMedia, CardBadge, CompositeCard } from "./Card";
export type { CardProps, CardVariant, CardPadding, CardHeaderProps, CardTitleProps, CardDescriptionProps, CardContentProps, CardFooterProps, CardMediaProps, CardBadgeProps, CompositeCardProps } from "./Card";

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

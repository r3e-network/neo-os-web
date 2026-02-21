import { Button as TaroButton } from "@tarojs/components";
import { ReactNode } from "react";
import "./Button.scss";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  className?: string;
}

export function Button({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "medium",
  className = "",
}: ButtonProps) {
  return (
    <TaroButton
      className={`neo-btn neo-btn-${variant} neo-btn-${size} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? "处理中..." : children}
    </TaroButton>
  );
}

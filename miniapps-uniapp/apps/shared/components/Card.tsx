import { View } from "@tarojs/components";
import { ReactNode } from "react";
import "./Card.scss";

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Card({ children, title, className = "" }: CardProps) {
  return (
    <View className={`neo-card ${className}`}>
      {title && <View className="neo-card-title">{title}</View>}
      <View className="neo-card-content">{children}</View>
    </View>
  );
}

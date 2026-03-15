import { Input as TaroInput, View, Text } from "@tarojs/components";
import "./Input.scss";

interface InputProps {
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  label?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export function Input({ value, onChange, type = "text", placeholder, label, min, max, disabled = false }: InputProps) {
  return (
    <View className="neo-input-wrapper">
      {label && <Text className="neo-input-label">{label}</Text>}
      <TaroInput
        className="neo-input"
        type={type}
        value={String(value)}
        placeholder={placeholder}
        disabled={disabled}
        onInput={(e) => onChange(e.detail.value)}
      />
    </View>
  );
}

import { View, Text } from "@tarojs/components";
import "./StatBox.scss";

interface StatBoxProps {
  value: string | number;
  label: string;
  icon?: string;
}

export function StatBox({ value, label, icon }: StatBoxProps) {
  return (
    <View className="neo-stat-box">
      {icon && <Text className="neo-stat-icon">{icon}</Text>}
      <Text className="neo-stat-value">{value}</Text>
      <Text className="neo-stat-label">{label}</Text>
    </View>
  );
}

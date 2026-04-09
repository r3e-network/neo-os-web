import "./LtvBar.scss";

interface LtvBarProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function LtvBar(props: LtvBarProps) {
  return (
    <div className="LtvBar">
      {/* Migrated from LtvBar.vue */}
    </div>
  );
}

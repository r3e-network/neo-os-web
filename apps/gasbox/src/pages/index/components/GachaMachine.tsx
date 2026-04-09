import "./GachaMachine.scss";

interface GachaMachineProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function GachaMachine(props: GachaMachineProps) {
  return (
    <div className="GachaMachine">
      {/* Migrated from GachaMachine.vue */}
    </div>
  );
}

import "./FlowVisualization.scss";

interface FlowVisualizationProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function FlowVisualization(props: FlowVisualizationProps) {
  return (
    <div className="FlowVisualization">
      {/* Migrated from FlowVisualization.vue */}
    </div>
  );
}

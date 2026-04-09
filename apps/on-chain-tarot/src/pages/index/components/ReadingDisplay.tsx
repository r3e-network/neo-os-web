import "./ReadingDisplay.scss";

interface ReadingDisplayProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function ReadingDisplay(props: ReadingDisplayProps) {
  return (
    <div className="ReadingDisplay">
      {/* Migrated from ReadingDisplay.vue */}
    </div>
  );
}

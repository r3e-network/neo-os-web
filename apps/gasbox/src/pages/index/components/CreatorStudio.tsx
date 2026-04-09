import "./CreatorStudio.scss";

interface CreatorStudioProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function CreatorStudio(props: CreatorStudioProps) {
  return (
    <div className="CreatorStudio">
      {/* Migrated from CreatorStudio.vue */}
    </div>
  );
}

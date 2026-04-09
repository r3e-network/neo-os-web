import "./StreamList.scss";

interface StreamListProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function StreamList(props: StreamListProps) {
  return (
    <div className="StreamList">
      {/* Migrated from StreamList.vue */}
    </div>
  );
}

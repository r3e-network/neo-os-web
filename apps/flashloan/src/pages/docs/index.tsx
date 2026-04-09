import "./index.scss";

interface indexProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function index(props: indexProps) {
  return (
    <div className="index">
      {/* Migrated from index.vue */}
    </div>
  );
}

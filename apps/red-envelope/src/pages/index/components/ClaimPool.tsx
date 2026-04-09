import "./ClaimPool.scss";

interface ClaimPoolProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function ClaimPool(props: ClaimPoolProps) {
  return (
    <div className="ClaimPool">
      {/* Migrated from ClaimPool.vue */}
    </div>
  );
}

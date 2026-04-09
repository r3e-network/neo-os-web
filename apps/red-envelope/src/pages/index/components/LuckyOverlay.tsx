import "./LuckyOverlay.scss";

interface LuckyOverlayProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function LuckyOverlay(props: LuckyOverlayProps) {
  return (
    <div className="LuckyOverlay">
      {/* Migrated from LuckyOverlay.vue */}
    </div>
  );
}

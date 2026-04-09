import "./PaymentTimeline.scss";

interface PaymentTimelineProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function PaymentTimeline(props: PaymentTimelineProps) {
  return (
    <div className="PaymentTimeline">
      {/* Migrated from PaymentTimeline.vue */}
    </div>
  );
}

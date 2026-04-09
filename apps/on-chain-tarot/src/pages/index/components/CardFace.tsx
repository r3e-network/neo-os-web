import "./CardFace.scss";

interface CardFaceProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function CardFace(props: CardFaceProps) {
  return (
    <div className="CardFace">
      {/* Migrated from CardFace.vue */}
    </div>
  );
}

import "./GameArea.scss";

interface GameAreaProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function GameArea(props: GameAreaProps) {
  return (
    <div className="GameArea">
      {/* Migrated from GameArea.vue */}
    </div>
  );
}

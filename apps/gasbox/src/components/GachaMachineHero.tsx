import "./GachaMachineHero.scss";

interface GachaMachineHeroProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function GachaMachineHero(props: GachaMachineHeroProps) {
  return (
    <div className="GachaMachineHero">
      {/* Migrated from GachaMachineHero.vue */}
    </div>
  );
}

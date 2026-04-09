import "./FlashloanHero.scss";

interface FlashloanHeroProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function FlashloanHero(props: FlashloanHeroProps) {
  return (
    <div className="FlashloanHero">
      {/* Migrated from FlashloanHero.vue */}
    </div>
  );
}

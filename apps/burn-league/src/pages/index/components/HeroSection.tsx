import "./HeroSection.scss";

interface HeroSectionProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function HeroSection(props: HeroSectionProps) {
  return (
    <div className="HeroSection">
      {/* Migrated from HeroSection.vue */}
    </div>
  );
}

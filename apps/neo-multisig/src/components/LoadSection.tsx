import { NeoInput, NeoButton } from "@shared/components-react";

interface LoadSectionProps { value: string; onChange: (val: string) => void; label: string; placeholder: string; buttonText: string; onLoad: () => void; }

export default function LoadSection({ value, onChange, label, placeholder, buttonText, onLoad }: LoadSectionProps) {
  return (
    <div className="load-section">
      <NeoInput value={value} label={label} placeholder={placeholder} onChange={onChange} />
      <NeoButton variant="secondary" onClick={onLoad}>{buttonText}</NeoButton>
    </div>
  );
}

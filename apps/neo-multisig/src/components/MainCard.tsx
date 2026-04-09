import { NeoInput, NeoButton } from "@shared/components-react";
import CreateCard from "./CreateCard";
import LoadSection from "./LoadSection";

interface MainCardProps {
  value: string; onChange: (val: string) => void; createTitle: string; createDesc: string;
  dividerText: string; loadLabel: string; loadPlaceholder: string; loadButtonText: string;
  onCreate: () => void; onLoad: () => void;
}

export default function MainCard({ value, onChange, createTitle, createDesc, dividerText, loadLabel, loadPlaceholder, loadButtonText, onCreate, onLoad }: MainCardProps) {
  return (
    <div className="main-card">
      <CreateCard title={createTitle} description={createDesc} onCreate={onCreate} />
      <div className="divider"><div className="divider-line" /><span className="divider-text">{dividerText}</span><div className="divider-line" /></div>
      <LoadSection value={value} onChange={onChange} label={loadLabel} placeholder={loadPlaceholder} buttonText={loadButtonText} onLoad={onLoad} />
    </div>
  );
}

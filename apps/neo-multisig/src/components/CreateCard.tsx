import { NeoButton } from "@shared/components-react";

interface CreateCardProps { title: string; description: string; onCreate: () => void; }

export default function CreateCard({ title, description, onCreate }: CreateCardProps) {
  return (
    <div className="create-card">
      <span className="create-title">{title}</span>
      <span className="create-desc">{description}</span>
      <NeoButton variant="primary" onClick={onCreate}>{title}</NeoButton>
    </div>
  );
}

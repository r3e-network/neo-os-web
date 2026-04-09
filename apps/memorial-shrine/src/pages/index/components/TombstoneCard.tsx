interface TombstoneCardProps {
  memorial: { id: number; name?: string; birthYear?: number; deathYear?: number; [key: string]: unknown };
  onClick: () => void; t: (key: string) => string;
}

export default function TombstoneCard({ memorial, onClick, t }: TombstoneCardProps) {
  return (
    <button type="button" className="tombstone-card" aria-label={memorial.name ?? ""} onClick={onClick}>
      <div className="tombstone-body">
        <span className="name">{memorial.name}</span>
        {memorial.birthYear && memorial.deathYear && <span className="years">{memorial.birthYear}-{memorial.deathYear}</span>}
      </div>
    </button>
  );
}

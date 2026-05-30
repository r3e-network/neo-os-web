interface TombstoneCardProps {
  memorial: { id: number; name?: string; birthYear?: number; deathYear?: number; relationship?: string; [key: string]: unknown };
  onClick: () => void; t: (key: string) => string;
}

export default function TombstoneCard({ memorial, onClick, t }: TombstoneCardProps) {
  const relationship = typeof memorial.relationship === "string" ? memorial.relationship : "";
  return (
    <button type="button" className="tombstone-card" aria-label={memorial.name ?? ""} onClick={onClick}>
      <span className="tombstone-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6.5-4.35-9-8.5C1.5 9.5 3 6 6.5 6 9 6 10.5 7.5 12 9.5 13.5 7.5 15 6 17.5 6 21 6 22.5 9.5 21 12.5 18.5 16.65 12 21 12 21Z" />
        </svg>
      </span>
      <div className="tombstone-body">
        <span className="name">{memorial.name}</span>
        {memorial.birthYear && memorial.deathYear && <span className="years">{memorial.birthYear}-{memorial.deathYear}</span>}
      </div>
      {relationship && <span className="tombstone-relation">{relationship}</span>}
    </button>
  );
}

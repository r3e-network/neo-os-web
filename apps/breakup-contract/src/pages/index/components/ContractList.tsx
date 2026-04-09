interface ContractListProps { contracts: unknown[]; address: string | null; onSign: (c: unknown) => void; onBreak: (c: unknown) => void; t: (key: string) => string; }

export default function ContractList({ contracts, address, onSign, onBreak, t }: ContractListProps) {
  return (
    <div className="contracts-list">
      {(contracts as Array<Record<string, unknown>>).map((contract) => (
        <div key={String(contract.id)} className="contract-card">
          <span>{String(contract.name || contract.id)}</span>
        </div>
      ))}
    </div>
  );
}

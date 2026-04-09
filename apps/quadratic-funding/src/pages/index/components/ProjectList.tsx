export interface ProjectItem {
  id: string; roundId: string; owner: string; name: string; description: string; link: string;
  totalContributed: bigint; contributorCount: bigint; matchedAmount: bigint; active: boolean; claimed: boolean; status?: string;
}
export default function ProjectList() { return null; }

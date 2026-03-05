export interface CharityCampaign {
  id: number;
  title: string;
  description: string;
  story: string;
  category: string;
  organizer: string;
  beneficiary: string;
  targetAmount: number;
  raisedAmount: number;
  donorCount: number;
  endTime: number;
  createdAt: number;
  status: "active" | "completed" | "withdrawn" | "cancelled";
  multisigAddresses: string[];
}

export interface Donation {
  id: number;
  campaignId: number;
  donor: string;
  amount: number;
  message: string;
  timestamp: number;
}

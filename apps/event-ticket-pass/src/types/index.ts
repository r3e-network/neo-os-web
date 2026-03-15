export interface EventItem {
  id: string;
  creator: string;
  name: string;
  venue: string;
  startTime: number;
  endTime: number;
  maxSupply: bigint;
  minted: bigint;
  notes: string;
  active: boolean;
}

export interface TicketItem {
  tokenId: string;
  eventId: string;
  eventName: string;
  venue: string;
  startTime: number;
  endTime: number;
  seat: string;
  memo: string;
  issuedTime: number;
  used: boolean;
  usedTime: number;
}

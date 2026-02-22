// Template Components Export
// Export all template-specific components for easy importing

// Prediction Market Components
export {
  PredictionOutcomes,
  PredictionStats,
  PriceHistory,
  UserPosition,
  type PredictionOutcome,
  type PredictionMarketData,
} from "./PredictionMarketComponents";

// Voting Components
export {
  VotingProgress,
  VotingStats,
  DelegationInfo,
  type VotingOption,
  type VotingData,
} from "./VotingComponents";

// Lottery Components
export {
  LotteryPool,
  LotteryCountdown,
  UserTickets,
  PastDraws,
  type LotteryData,
} from "./LotteryComponents";

// Auction Components
export {
  AuctionItem,
  AuctionStatus,
  BidHistory,
  DutchAuction,
  type AuctionBid,
  type AuctionData,
} from "./AuctionComponents";

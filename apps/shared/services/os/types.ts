import type { StorageProxy } from "./StorageProxy";
import type { PaymentProxy } from "./PaymentProxy";
import type { GameProxy } from "./GameProxy";
import type { VestingProxy } from "./VestingProxy";
import type { EscrowProxy } from "./EscrowProxy";
import type { BadgeProxy } from "./BadgeProxy";
import type { LeaderboardProxy } from "./LeaderboardProxy";
import type { CheckinProxy } from "./CheckinProxy";
import type { NFTProxy } from "./NFTProxy";

/** All OS services available through PlatformContext.os */
export interface OSServices {
  storage: StorageProxy;
  payment: PaymentProxy;
  game: GameProxy;
  vesting: VestingProxy;
  escrow: EscrowProxy;
  badge: BadgeProxy;
  leaderboard: LeaderboardProxy;
  checkin: CheckinProxy;
  nft: NFTProxy;
}

using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// MiniAppDiceGameV2 — self-contained on-chain 6-sided dice game with a COMMIT/REVEAL
    /// settlement that closes the same-tx abort-on-loss exploit of v1 (MiniAppDiceGame).
    ///
    /// EXPLOIT IN v1: v1 consumed the wager AND settled the roll in the SAME transaction
    /// with Runtime.GetRandom. An attacker contract could deposit, call roll(), read the
    /// rolled face, and ABORT the whole transaction on a loss (reverting its own wager)
    /// while letting the rare 5.70x win commit. Because losses cost nothing and a win pays
    /// 5.70x, EV was strictly positive and the house bankroll was drainable.
    ///
    /// FIX — COMMIT/REVEAL ACROSS BLOCKS:
    ///   1. commit(player, face, amount): irrevocably escrows the wager from the player
    ///      credit and RESERVES the worst-case house exposure (= amount*47/10, the extra a
    ///      5.70x win pays beyond the wager) from the bankroll, recording
    ///      commitIndex = Ledger.CurrentIndex. Block N. Outcome NOT decided here.
    ///   2. settle(betId): PERMISSIONLESS. Asserts Ledger.CurrentIndex > commitIndex + K
    ///      (K = BEACON_BLOCKS = 3), then derives the rolled face from a FIXED multi-block
    ///      beacon — the concat-hash of the hashes of blocks commitIndex+1 .. commitIndex+K
    ///      (all unknown at commit, immutable once produced) — mixed with
    ///      betId+player+commitIndex, reduced to [1,6]. Because every beacon block is a fixed
    ///      past block, re-calling settle in any later block yields the SAME roll, so a player
    ///      cannot abort-on-loss and retry for a different outcome (an earlier design used
    ///      Runtime.GetRandom() at settle, which re-rolled every block and did NOT close the
    ///      exploit).
    ///
    /// MULTI-BLOCK BEACON (grinding cost): the entropy mixes K = 3 CONSECUTIVE block hashes,
    /// not a single one. To bias the roll a block producer would have to influence/withhold
    /// all K beacon blocks in a row, which is far costlier than grinding a single block. This
    /// is NOT VRF-grade randomness (a sustained majority of consecutive producers could still
    /// influence the draw), so it is intended for the low-stakes dice game; high-value draws
    /// should use the VRF oracle when operational.
    ///
    /// PAYOUT / EDGE: a win pays 5.70x the wager (amount*57/10). A fair 1/6 game would pay
    /// 6x; 5.70x leaves the house a 5% edge ((6 - 5.7)/6 = 0.05). The reserved house
    /// exposure per bet is payout - amount = amount*47/10.
    ///
    /// RESERVATION: each pending bet reserves amount*47/10 into reservedBankroll; a new
    /// commit is rejected unless freeBankroll = bankroll - reservedBankroll covers it. So
    /// concurrent pending bets can never oversubscribe — EVERY pending win is fully payable.
    ///
    /// MODEL: GAS only, BASE UNITS (1 GAS = 1e8). Memos and OnNEP17Payment credit-only
    /// behaviour are identical to v1 (fund "miniapp-dice-game:fund", bet
    /// "miniapp-dice-game:stake"). Owner is unchanged.
    ///
    /// SOLVENCY INVARIANT (asserted in tests):
    ///   heldGAS == bankroll + sum(escrowed pending amounts) + sum(player credits)
    ///   reservedBankroll <= bankroll
    /// </summary>
    [DisplayName("MiniAppDiceGameV2")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Commit/reveal on-chain dice: 5.70x payout settled across blocks with reserved bankroll — closes the same-tx abort-on-loss exploit.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppDiceGameV2 : SmartContract
    {
        #region Constants (base units)
        private const long MIN_BET = 5_000_000;        // 0.05 GAS
        private const long MAX_BET = 2_000_000_000;    // 20 GAS
        private const string FUND_MEMO = "miniapp-dice-game:fund";
        private const string BET_MEMO = "miniapp-dice-game:stake";

        // Payout multiplier 5.70x = amount * PAYOUT_NUM / PAYOUT_DEN (5% house edge over 1/6 fair).
        private const int PAYOUT_NUM = 57;
        private const int PAYOUT_DEN = 10;
        // Extra-from-house a win pays beyond the wager = payout - amount = amount * EXTRA_NUM / PAYOUT_DEN.
        private const int EXTRA_NUM = 47; // 57 - 10

        // Number of consecutive beacon blocks mixed into the reveal entropy. settle requires
        // a strictly later block than commitIndex + K so all K beacons (commitIndex+1 ..
        // commitIndex+K) exist and are immutable, raising the cost of grinding the roll (a
        // single-block beacon could be biased by that one block's producer).
        private const int BEACON_BLOCKS = 3;

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_BANKROLL = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_RESERVED = new byte[] { 0x17 };      // reserved house exposure
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x11 };        // + player -> GAS credit
        private static readonly byte[] PREFIX_STATS = new byte[] { 0x12 };         // + player -> Stats
        private static readonly byte[] PREFIX_BET_ID = new byte[] { 0x13 };        // last bet id
        private static readonly byte[] PREFIX_BET = new byte[] { 0x14 };           // + betId -> Bet
        private static readonly byte[] PREFIX_PLAYER_CNT = new byte[] { 0x15 };    // + player -> count
        private static readonly byte[] PREFIX_PLAYER_ITEM = new byte[] { 0x16 };   // + player + seq -> betId
        private static readonly byte[] PREFIX_PENDING_CNT = new byte[] { 0x18 };   // number of unsettled bets
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("BankrollFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnBankrollFunded; // from, amount, bankroll
        [DisplayName("Committed")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnCommitted; // betId, player, face, amount, commitIndex
        [DisplayName("Settled")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, bool, BigInteger> OnSettled; // betId, player, face, rolled, won, payout
        [DisplayName("BankrollWithdrawn")]
        public static event Action<UInt160, BigInteger> OnBankrollWithdrawn;
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // account, amount
        #endregion

        #region Types
        public struct Stats
        {
            public BigInteger Wins;
            public BigInteger Losses;
            public BigInteger TotalWon; // total GAS profit paid to the player (sum of extra-from-house on wins)
        }
        public struct Bet
        {
            public UInt160 Player;
            public BigInteger Face;        // chosen face, 1..6
            public BigInteger Wager;       // escrowed amount
            public BigInteger Exposure;    // house reservation released at settle (= amount*47/10)
            public BigInteger CommitIndex; // Ledger.CurrentIndex at commit
            public BigInteger CommitTime;  // Runtime.Time at commit
            public bool Settled;
            public BigInteger Rolled;      // rolled face 1..6 once settled
            public bool Won;
            public BigInteger Payout;      // amount*57/10 on win, 0 on loss
            public BigInteger SettleTime;
        }
        #endregion

        #region Deposit (bankroll + bet credit) — CREDIT ONLY, no transfers/business logic
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            string memo = (string)data;
            StorageContext ctx = Storage.CurrentContext;

            if (memo == FUND_MEMO)
            {
                BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL) + amount;
                Storage.Put(ctx, PREFIX_BANKROLL, bankroll);
                OnBankrollFunded(from, amount, bankroll);
                return;
            }
            if (memo == BET_MEMO)
            {
                byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
                BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
                Storage.Put(ctx, key, bal);
                OnCredited(from, amount, bal);
                return;
            }
            ExecutionEngine.Assert(false, "invalid memo");
        }
        #endregion

        #region Settle (later block — reveal + pay) — PERMISSIONLESS
        /// <summary>
        /// Reveal and settle a committed bet. PERMISSIONLESS: anyone can call so losses can
        /// never be withheld. Requires Ledger.CurrentIndex strictly greater than the bet's
        /// commitIndex + BEACON_BLOCKS (so all K beacon blocks already exist), so the beacon
        /// blocks used to decide the roll were unknown when the wager was committed. On a win
        /// pays 5.70x (escrow + reserved house portion); on a loss the escrowed wager funds
        /// the bankroll. Always releases the reservation. Returns the rolled face (1..6).
        /// </summary>
        public static BigInteger Settle(BigInteger betId)
        {
            StorageContext ctx = Storage.CurrentContext;
            ByteString raw = Storage.Get(ctx, BetKey(betId));
            ExecutionEngine.Assert(raw is not null, "bet not found");
            Bet b = (Bet)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(!b.Settled, "bet already settled");
            ExecutionEngine.Assert(Ledger.CurrentIndex > b.CommitIndex + BEACON_BLOCKS, "reveal must be a later block");

            // Rolled face from a FIXED multi-block beacon: the concat-hash of the hashes of the
            // K blocks commitIndex+1 .. commitIndex+K, accumulated into a single entropy value
            // (all unknown at commit, immutable once produced). Mixing K consecutive block
            // hashes raises the grinding cost — biasing the roll requires influencing/
            // withholding all K beacon blocks in a row, not just one. Re-calling settle in ANY
            // later block yields the SAME roll (the beacons are fixed past blocks), so an
            // abort-and-retry via a wrapper contract gains nothing. This is what actually
            // closes the v1-class abort-on-loss exploit: Runtime.GetRandom() re-rolls every
            // block (so a permissionless atomic settle could be aborted on a loss and retried
            // until a win), whereas fixed past-block hashes cannot be re-rolled. The assert
            // above (CurrentIndex > CommitIndex + BEACON_BLOCKS) guarantees every beacon block
            // exists.
            ByteString beaconBytes = (ByteString)new byte[0];
            for (int i = 1; i <= BEACON_BLOCKS; i++)
            {
                var beacon = Ledger.GetBlock((uint)(b.CommitIndex + i));
                ExecutionEngine.Assert(beacon is not null, "beacon block unavailable");
                beaconBytes = Helper.Concat(beaconBytes, (ByteString)(byte[])beacon.Hash);
            }
            BigInteger entropy = (BigInteger)CryptoLib.Sha256(beaconBytes);
            if (entropy < 0) entropy = -entropy;
            BigInteger mix = (BigInteger)(ByteString)(byte[])b.Player + betId + b.CommitIndex;
            if (mix < 0) mix = -mix;
            BigInteger rolled = (entropy + mix) % 6 + 1;
            bool won = rolled == b.Face;

            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            // Release this bet's reservation unconditionally.
            reserved -= b.Exposure;

            Stats s = LoadStats(ctx, b.Player);
            BigInteger payout = 0;
            if (won)
            {
                payout = b.Wager * PAYOUT_NUM / PAYOUT_DEN;
                bankroll -= b.Exposure;   // the reserved extra-from-house is spent on the win
                s.Wins += 1;
                s.TotalWon += b.Exposure; // player's net profit
            }
            else
            {
                bankroll += b.Wager;      // the escrowed wager funds the house
                s.Losses += 1;
            }

            // Effects before interaction.
            Storage.Put(ctx, PREFIX_BANKROLL, bankroll);
            Storage.Put(ctx, PREFIX_RESERVED, reserved);
            Storage.Put(ctx, StatsKey(b.Player), StdLib.Serialize(s));

            b.Settled = true;
            b.Rolled = rolled;
            b.Won = won;
            b.Payout = payout;
            b.SettleTime = Runtime.Time;
            Storage.Put(ctx, BetKey(betId), StdLib.Serialize(b));

            BigInteger pending = (BigInteger)Storage.Get(ctx, PREFIX_PENDING_CNT);
            if (pending > 0) Storage.Put(ctx, PREFIX_PENDING_CNT, pending - 1);

            if (won)
            {
                bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                    new object[] { Runtime.ExecutingScriptHash, b.Player, payout, "" });
                ExecutionEngine.Assert(ok, "payout transfer failed");
            }

            OnSettled(betId, b.Player, b.Face, rolled, won, payout);
            return rolled;
        }
        #endregion
    }
}

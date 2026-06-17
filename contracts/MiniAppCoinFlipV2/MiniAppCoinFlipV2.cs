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
    /// MiniAppCoinFlipV2 — self-contained on-chain coin-flip game with a COMMIT/REVEAL
    /// settlement that closes the same-tx abort-on-loss exploit of v1 (MiniAppCoinFlip).
    ///
    /// EXPLOIT IN v1: v1 consumed the wager AND settled the flip in the SAME transaction
    /// with Runtime.GetRandom. An attacker contract could deposit, call flip(), read the
    /// outcome, and ABORT the whole transaction on a loss (reverting its own wager) while
    /// letting wins commit. Because losses cost nothing and wins pay 2x, EV was strictly
    /// positive and the house bankroll was drainable.
    ///
    /// FIX — COMMIT/REVEAL ACROSS BLOCKS:
    ///   1. commit(player, choice, amount): irrevocably escrows the wager from the player
    ///      credit and RESERVES the house exposure (= amount, the extra a 2x win pays) from
    ///      the bankroll, recording commitIndex = Ledger.CurrentIndex. This write is in
    ///      block N. The outcome is NOT decided here.
    ///   2. settle(betId): PERMISSIONLESS. Asserts Ledger.CurrentIndex > commitIndex + K
    ///      (K = BEACON_BLOCKS = 3), then derives the outcome from a FIXED multi-block beacon
    ///      — the concat-hash of the hashes of blocks commitIndex+1 .. commitIndex+K (all
    ///      unknown at commit, immutable once produced) — mixed with betId+player+commitIndex.
    ///      Because every beacon block is a fixed past block, re-calling settle in any later
    ///      block yields the SAME outcome, so a player CANNOT abort an unfavourable settle via
    ///      a wrapper and retry for a different result (an earlier design used
    ///      Runtime.GetRandom() at settle, which re-rolled every block and did NOT close that
    ///      abort-on-loss drain).
    ///
    /// MULTI-BLOCK BEACON (grinding cost): the entropy mixes K = 3 CONSECUTIVE block hashes,
    /// not a single one. To bias the outcome a block producer would have to influence/withhold
    /// all K beacon blocks in a row, which is far costlier than grinding a single block. This
    /// is NOT VRF-grade randomness (a sustained majority of consecutive producers could still
    /// influence the draw), so it is intended for the low-stakes coin flip; high-value draws
    /// should use the VRF oracle when operational.
    ///
    /// RESERVATION: every pending bet reserves its worst-case house exposure (a 2x win pays
    /// an extra `amount` from the house) into reservedBankroll, and a new commit is rejected
    /// unless freeBankroll = bankroll - reservedBankroll covers it. So concurrent pending
    /// bets can never oversubscribe the bankroll — EVERY pending win is fully payable.
    ///
    /// MODEL: GAS only, BASE UNITS (1 GAS = 1e8). House funds the bankroll (memo
    /// "miniapp-fogplay:fund"); a player prepays a wager (memo "miniapp-fogplay:bet"). Memos
    /// and OnNEP17Payment credit-only behaviour are identical to v1. Owner is unchanged.
    ///
    /// SOLVENCY INVARIANT (asserted in tests):
    ///   heldGAS == bankroll + sum(escrowed pending amounts) + sum(player credits)
    ///   reservedBankroll <= bankroll
    /// </summary>
    [DisplayName("MiniAppCoinFlipV2")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "2.0.0")]
    [ManifestExtra("Description", "Commit/reveal on-chain coin flip: 2x payout settled across blocks with reserved bankroll — closes the same-tx abort-on-loss exploit.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppCoinFlipV2 : SmartContract
    {
        #region Constants (base units)
        private const long MIN_BET = 5_000_000;        // 0.05 GAS
        private const long MAX_BET = 10_000_000_000;   // 100 GAS
        private const string FUND_MEMO = "miniapp-fogplay:fund";
        private const string BET_MEMO = "miniapp-fogplay:bet";

        // Number of consecutive beacon blocks mixed into the reveal entropy. settle requires
        // a strictly later block than commitIndex + K so all K beacons (commitIndex+1 ..
        // commitIndex+K) exist and are immutable, raising the cost of grinding the outcome
        // (a single-block beacon could be biased by that one block's producer).
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
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, BigInteger> OnCommitted; // betId, player, choice, amount, commitIndex
        [DisplayName("Settled")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, bool, BigInteger> OnSettled; // betId, player, choice, outcome, won, payout
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
            public BigInteger TotalWon; // total GAS profit paid to the player (sum of winning wagers)
        }
        public struct Bet
        {
            public UInt160 Player;
            public BigInteger Choice;      // 0 = heads, 1 = tails
            public BigInteger Wager;       // escrowed amount
            public BigInteger Exposure;    // house reservation released at settle (= wager)
            public BigInteger CommitIndex; // Ledger.CurrentIndex at commit
            public BigInteger CommitTime;  // Runtime.Time at commit
            public bool Settled;
            public BigInteger Outcome;     // 0 / 1 once settled
            public bool Won;
            public BigInteger Payout;      // 2*wager on win, 0 on loss
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
        /// blocks used to decide the flip were unknown when the wager was committed. On a win
        /// pays 2x (escrow + reserved house portion); on a loss the escrowed wager funds the
        /// bankroll. Always releases the reservation. Returns the outcome (0/1).
        /// </summary>
        public static BigInteger Settle(BigInteger betId)
        {
            StorageContext ctx = Storage.CurrentContext;
            ByteString raw = Storage.Get(ctx, BetKey(betId));
            ExecutionEngine.Assert(raw is not null, "bet not found");
            Bet b = (Bet)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(!b.Settled, "bet already settled");
            ExecutionEngine.Assert(Ledger.CurrentIndex > b.CommitIndex + BEACON_BLOCKS, "reveal must be a later block");

            // Outcome from a FIXED multi-block beacon: the concat-hash of the hashes of the K
            // blocks commitIndex+1 .. commitIndex+K, accumulated into a single entropy value
            // (all unknown at commit, immutable once produced). Mixing K consecutive block
            // hashes raises the grinding cost — biasing the outcome requires influencing/
            // withholding all K beacon blocks in a row, not just one. Re-calling settle in ANY
            // later block yields the SAME outcome (the beacons are fixed past blocks), so a
            // player cannot abort an unfavourable settle via a wrapper contract and retry until
            // a win — this is what closes the abort-on-loss bankroll drain. (Runtime.GetRandom()
            // at settle re-rolls every block and did NOT close it.) The assert above
            // (CurrentIndex > CommitIndex + BEACON_BLOCKS) guarantees every beacon block exists.
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
            BigInteger outcome = (entropy + mix) % 2;
            bool won = outcome == b.Choice;

            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            // Release this bet's reservation unconditionally.
            reserved -= b.Exposure;

            Stats s = LoadStats(ctx, b.Player);
            BigInteger payout = 0;
            if (won)
            {
                payout = b.Wager * 2;
                bankroll -= b.Exposure;   // the reserved extra is spent on the win
                s.Wins += 1;
                s.TotalWon += b.Wager;    // player's net profit
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
            b.Outcome = outcome;
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

            OnSettled(betId, b.Player, b.Choice, outcome, won, payout);
            return outcome;
        }
        #endregion
    }
}

using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Shared commit/reveal engine for house-banked GAS games (CoinFlipV2, DiceGameV2, ...).
    ///
    /// Both deployed games hand-rolled the SAME settlement: deposit -> commit at block N
    /// (escrow the wager + reserve the worst-case house exposure) -> settle in a LATER block
    /// using a FIXED multi-block beacon (the concat-hash of Ledger.GetBlock(commit+1..+K).Hash)
    /// mixed with betId+player+commitIndex, with pull-payment credit + Withdraw and a bankroll
    /// solvency guard. The two identical copies diverged twice during audits ("re-rollable settle
    /// bankroll drain", "mix K-block entropy to raise grinding cost"), each fix applied to both
    /// files. This base holds that engine ONCE so a future fix lands in a single place.
    ///
    /// WHY A FIXED MULTI-BLOCK BEACON: every beacon block is a fixed past block, so re-calling
    /// settle in any later block yields the SAME outcome — a player cannot abort an unfavourable
    /// settle via a wrapper contract and retry for a different result (Runtime.GetRandom re-rolls
    /// every block and did NOT close that abort-on-loss drain). Mixing K consecutive block hashes
    /// raises the grinding cost: biasing the outcome means influencing/withholding all K beacon
    /// blocks in a row. This is NOT VRF-grade randomness — intended for low-stakes games only.
    ///
    /// GAME-SPECIFIC values stay in the derived contract and are passed in as parameters:
    /// memo strings, MIN/MAX bet, the per-bet exposure, the outcome modulus/offset, the payout
    /// ratio, and which amount feeds the player's TotalWon stat. The derived contract keeps its
    /// own public ABI (commit/settle/reads), typed events, and the Owner constant; the C# DevPack
    /// requires events and the InitialValue Owner to live on the concrete class.
    ///
    /// SOLVENCY INVARIANT: heldGAS == bankroll + sum(escrowed pending wagers) + sum(player
    /// credits); reservedBankroll &lt;= bankroll. Every pending win stays fully payable because
    /// each commit reserves its worst-case exposure from the free bankroll.
    /// </summary>
    public abstract partial class MiniAppHouseGameBase : SmartContract
    {
        #region Shared constants
        /// <summary>Smallest accepted wager (base units): 0.05 GAS. Same for every game.</summary>
        protected const long MIN_BET = 5_000_000;

        /// <summary>
        /// Consecutive beacon blocks mixed into the reveal entropy. settle requires a strictly
        /// later block than commitIndex + K so all K beacons (commitIndex+1 .. commitIndex+K)
        /// exist and are immutable.
        /// </summary>
        protected const int BEACON_BLOCKS = 3;
        #endregion

        #region Shared storage prefixes (byte-identical to the deployed games)
        protected static readonly byte[] PREFIX_BANKROLL = new byte[] { 0x10 };
        protected static readonly byte[] PREFIX_RESERVED = new byte[] { 0x17 };      // reserved house exposure
        protected static readonly byte[] PREFIX_CREDIT = new byte[] { 0x11 };        // + player -> GAS credit
        protected static readonly byte[] PREFIX_STATS = new byte[] { 0x12 };         // + player -> Stats
        protected static readonly byte[] PREFIX_BET_ID = new byte[] { 0x13 };        // last bet id
        protected static readonly byte[] PREFIX_BET = new byte[] { 0x14 };           // + betId -> Bet
        protected static readonly byte[] PREFIX_PLAYER_CNT = new byte[] { 0x15 };    // + player -> count
        protected static readonly byte[] PREFIX_PLAYER_ITEM = new byte[] { 0x16 };   // + player + seq -> betId
        protected static readonly byte[] PREFIX_PENDING_CNT = new byte[] { 0x18 };   // unsettled bet count
        #endregion

        #region Shared types
        public struct Stats
        {
            public BigInteger Wins;
            public BigInteger Losses;
            public BigInteger TotalWon; // total GAS profit paid to the player
        }

        /// <summary>
        /// Bet record. Field order/types are byte-identical across every house game so the
        /// serialized layout (and thus deployed storage) is shared: Selection is the chosen
        /// value (coin choice / dice face), Result is the revealed value (flipped side / rolled
        /// face). The derived getPendingBet maps these neutral names to its own ABI keys.
        /// </summary>
        public struct Bet
        {
            public UInt160 Player;
            public BigInteger Selection;   // chosen value (choice 0/1, face 1..6)
            public BigInteger Wager;       // escrowed amount
            public BigInteger Exposure;    // house reservation released at settle
            public BigInteger CommitIndex; // Ledger.CurrentIndex at commit
            public BigInteger CommitTime;  // Runtime.Time at commit
            public bool Settled;
            public BigInteger Result;      // revealed value once settled
            public bool Won;
            public BigInteger Payout;      // gross paid to the player on a win, 0 on a loss
            public BigInteger SettleTime;
        }
        #endregion

        #region Deposit (bankroll + bet credit) — CREDIT ONLY
        /// <summary>
        /// Credit a GAS bankroll-fund deposit. Returns the new bankroll so the caller emits its
        /// own BankrollFunded event. Call only from OnNEP17Payment; does no transfers.
        /// </summary>
        protected static BigInteger CreditBankroll(BigInteger amount)
        {
            StorageContext ctx = Storage.CurrentContext;
            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL) + amount;
            Storage.Put(ctx, PREFIX_BANKROLL, bankroll);
            return bankroll;
        }

        /// <summary>
        /// Credit a GAS wager deposit to the sender's prepaid balance. Returns the new balance so
        /// the caller emits its own Credited event. Call only from OnNEP17Payment; does no
        /// transfers.
        /// </summary>
        protected static BigInteger CreditBet(UInt160 from, BigInteger amount)
        {
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
            BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, bal);
            return bal;
        }

        /// <summary>
        /// Validate the common OnNEP17Payment preconditions (GAS only, positive amount, memo
        /// present) and return the memo. The caller branches on the memo to CreditBankroll /
        /// CreditBet and asserts an unknown memo.
        /// </summary>
        protected static string ValidateDeposit(BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            return MiniAppCreditLedger.ReadPaymentMemo(data);
        }
        #endregion

        #region Commit (block N — escrow + reserve, no outcome)
        /// <summary>
        /// Shared commit engine: validate the player witness and bet range, escrow the wager
        /// from the player's prepaid credit, reserve `exposure` from the free bankroll, persist
        /// the Bet (with the game's `selection`), index it, and bump the pending count. The
        /// caller has already range-checked its own selection; this validates amount and credit
        /// and the bankroll reservation. Returns the new betId.
        /// </summary>
        protected static BigInteger CommitBet(UInt160 player, BigInteger selection, BigInteger amount, BigInteger maxBet, BigInteger exposure)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");
            ExecutionEngine.Assert(amount >= MIN_BET && amount <= maxBet, "bet out of range");

            StorageContext ctx = Storage.CurrentContext;

            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= amount, "insufficient bet credit");
            BigInteger nextCredit = credit - amount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            BigInteger free = bankroll - reserved;
            ExecutionEngine.Assert(free >= exposure, "free bankroll cannot cover this bet");
            Storage.Put(ctx, PREFIX_RESERVED, reserved + exposure);

            BigInteger betId = (BigInteger)Storage.Get(ctx, PREFIX_BET_ID) + 1;
            Storage.Put(ctx, PREFIX_BET_ID, betId);

            Bet b = new Bet
            {
                Player = player,
                Selection = selection,
                Wager = amount,
                Exposure = exposure,
                CommitIndex = Ledger.CurrentIndex,
                CommitTime = Runtime.Time,
                Settled = false,
                Result = 0,
                Won = false,
                Payout = 0,
                SettleTime = 0,
            };
            Storage.Put(ctx, BetKey(betId), StdLib.Serialize(b));
            IndexAppend(ctx, player, betId);

            BigInteger pending = (BigInteger)Storage.Get(ctx, PREFIX_PENDING_CNT) + 1;
            Storage.Put(ctx, PREFIX_PENDING_CNT, pending);
            return betId;
        }
        #endregion

        #region Owner-gated bankroll + withdraw
        /// <summary>
        /// Owner-only bankroll withdrawal. Never withdraws funds reserved against pending bets,
        /// so every committed-but-unsettled win stays fully payable. The caller has already
        /// asserted the owner witness.
        /// </summary>
        protected static void WithdrawBankrollChecked(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            BigInteger reserved = (BigInteger)Storage.Get(ctx, PREFIX_RESERVED);
            ExecutionEngine.Assert(bankroll - reserved >= amount, "insufficient free bankroll");
            Storage.Put(ctx, PREFIX_BANKROLL, bankroll - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "bankroll transfer failed");
        }

        /// <summary>
        /// Reclaim the caller's whole unused prepaid bet-credit. Does NOT touch escrowed pending
        /// wagers — those settle via settle(). Returns the refunded amount so the caller emits
        /// its CreditWithdrawn event.
        /// </summary>
        protected static BigInteger WithdrawCredit(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])account);
            BigInteger credit = (BigInteger)Storage.Get(ctx, key);
            ExecutionEngine.Assert(credit > 0, "no credit");
            Storage.Delete(ctx, key);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, account, credit, "" });
            ExecutionEngine.Assert(ok, "withdraw transfer failed");
            return credit;
        }
        #endregion
    }
}

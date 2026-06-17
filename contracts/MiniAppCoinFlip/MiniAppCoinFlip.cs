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
    /// MiniAppCoinFlip — self-contained on-chain coin-flip betting game (NO oracle).
    ///
    /// WHY: the FogPlay app routed bets through the OS game/payment kernel and
    /// expected a VRF oracle to settle "provably fair" flips — but that signer is
    /// non-operational, so bets were taken and never paid. This contract settles the
    /// flip ON-CHAIN with Runtime.GetRandom and pays a winner 2x ATOMICALLY in the
    /// same transaction, out of a house bankroll. No external settler, no pending bet.
    ///
    /// MODEL: the house funds a bankroll (GAS memo "miniapp-fogplay:fund"). A player
    /// prepays a wager (GAS memo "miniapp-fogplay:bet") then calls flip(player, choice,
    /// amount). A bet is only accepted when the bankroll can cover the win (bankroll >=
    /// amount), so EVERY win is fully payable — a flip never reverts for lack of funds.
    /// On a win the player receives 2x the wager (their stake back + an equal amount
    /// from the bankroll); on a loss the wager is added to the bankroll.
    ///
    /// RANDOMNESS: Runtime.GetRandom() (per-block consensus beacon, unknown until the
    /// tx mines) mixed with the player + time + game id. The outcome is decided in the
    /// SAME tx as the wager, so a player cannot see it and abort — there is no
    /// abort-and-retry. NOT VRF-grade; a block producer has some influence, so this is
    /// intended for low-stakes play (which is why MAX_BET is capped).
    ///
    /// SAFETY: GAS only, BASE UNITS (1 GAS = 1e8). Deposit-then-bet. Checks-effects-
    /// interactions: bankroll + stats + game record are written before the payout
    /// transfer; a failed transfer asserts and reverts the whole atomic invocation.
    /// </summary>
    [DisplayName("MiniAppCoinFlip")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain coin flip: 2x payout settled with Runtime.GetRandom from a house bankroll — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppCoinFlip : SmartContract
    {
        #region Constants (base units)
        private const long MIN_BET = 5_000_000;        // 0.05 GAS
        private const long MAX_BET = 10_000_000_000;   // 100 GAS
        private const string FUND_MEMO = "miniapp-fogplay:fund";
        private const string BET_MEMO = "miniapp-fogplay:bet";

        [InitialValue("NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32", ContractParameterType.Hash160)]
        private static readonly UInt160 Owner = default;
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_BANKROLL = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x11 };       // + player -> GAS credit
        private static readonly byte[] PREFIX_STATS = new byte[] { 0x12 };        // + player -> Stats
        private static readonly byte[] PREFIX_GAME_ID = new byte[] { 0x13 };
        private static readonly byte[] PREFIX_GAME = new byte[] { 0x14 };         // + gameId -> Game
        private static readonly byte[] PREFIX_PLAYER_CNT = new byte[] { 0x15 };   // + player -> count
        private static readonly byte[] PREFIX_PLAYER_ITEM = new byte[] { 0x16 };  // + player + seq -> gameId
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // from, amount, balance
        [DisplayName("BankrollFunded")]
        public static event Action<UInt160, BigInteger, BigInteger> OnBankrollFunded; // from, amount, bankroll
        [DisplayName("Flipped")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, bool, BigInteger> OnFlipped; // gameId, player, choice, outcome, won, payout
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
        public struct Game
        {
            public UInt160 Player;
            public BigInteger Choice;   // 0 = heads, 1 = tails
            public BigInteger Outcome;  // 0 / 1
            public bool Won;
            public BigInteger Wager;
            public BigInteger Payout;   // 2*wager on win, 0 on loss
            public BigInteger Time;
        }
        #endregion

        #region Deposit (bankroll + bet credit)
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

        #region Flip
        /// <summary>
        /// Settle a coin flip for the player's prepaid wager. choice: 0=heads, 1=tails.
        /// On a win the player is paid 2x atomically; on a loss the wager funds the bankroll.
        /// Returns the outcome (0/1).
        /// </summary>
        public static BigInteger Flip(UInt160 player, BigInteger choice, BigInteger amount)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");
            ExecutionEngine.Assert(choice == 0 || choice == 1, "choice must be 0 or 1");
            ExecutionEngine.Assert(amount >= MIN_BET && amount <= MAX_BET, "bet out of range");

            StorageContext ctx = Storage.CurrentContext;

            // Consume the prepaid wager.
            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= amount, "insufficient bet credit");
            BigInteger nextCredit = credit - amount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            // The bankroll must cover the extra `amount` a win pays beyond the wager,
            // so a win is always fully payable.
            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            ExecutionEngine.Assert(bankroll >= amount, "bankroll cannot cover this bet");

            // Outcome from the per-block beacon mixed with player + time + game id.
            BigInteger gameId = (BigInteger)Storage.Get(ctx, PREFIX_GAME_ID) + 1;
            Storage.Put(ctx, PREFIX_GAME_ID, gameId);
            BigInteger entropy = Runtime.GetRandom();
            if (entropy < 0) entropy = -entropy;
            BigInteger mix = (BigInteger)(ByteString)(byte[])player + Runtime.Time + gameId;
            if (mix < 0) mix = -mix;
            BigInteger outcome = (entropy + mix) % 2;
            bool won = outcome == choice;

            Stats s = LoadStats(ctx, player);
            BigInteger payout = 0;
            if (won)
            {
                payout = amount * 2;
                bankroll -= amount;       // pay an extra `amount` from the house
                s.Wins += 1;
                s.TotalWon += amount;     // player's net profit
            }
            else
            {
                bankroll += amount;       // the wager funds the house
                s.Losses += 1;
            }

            // Effects before interaction.
            Storage.Put(ctx, PREFIX_BANKROLL, bankroll);
            Storage.Put(ctx, StatsKey(player), StdLib.Serialize(s));
            Game g = new Game
            {
                Player = player, Choice = choice, Outcome = outcome, Won = won,
                Wager = amount, Payout = payout, Time = Runtime.Time,
            };
            Storage.Put(ctx, GameKey(gameId), StdLib.Serialize(g));
            IndexAppend(ctx, player, gameId);

            if (won)
            {
                bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                    new object[] { Runtime.ExecutingScriptHash, player, payout, "" });
                ExecutionEngine.Assert(ok, "payout transfer failed");
            }

            OnFlipped(gameId, player, choice, outcome, won, payout);
            return outcome;
        }
        #endregion

        #region Owner (bankroll withdrawal)
        public static void WithdrawBankroll(UInt160 to, BigInteger amount)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ExecutionEngine.Assert(to is not null && to.IsValid && !to.IsZero, "invalid recipient");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            StorageContext ctx = Storage.CurrentContext;
            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            ExecutionEngine.Assert(bankroll >= amount, "insufficient bankroll");
            Storage.Put(ctx, PREFIX_BANKROLL, bankroll - amount);
            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, to, amount, "" });
            ExecutionEngine.Assert(ok, "bankroll transfer failed");
            OnBankrollWithdrawn(to, amount);
        }

        /// <summary>Owner-gated, instant contract upgrade (no timelock).</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner), "owner only");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid bet-credit back to the sender.</summary>
        public static BigInteger Withdraw(UInt160 account)
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
            OnCreditWithdrawn(account, credit);
            return credit;
        }
        #endregion

    }
}

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
    /// MiniAppDiceGame — self-contained on-chain 6-sided dice betting game (NO oracle).
    ///
    /// WHY: the dice-game app routed bets through the OS game/VRF kernel and expected a
    /// VRF oracle to settle "provably fair" rolls — but that signer is non-operational,
    /// so stakes left the wallet on-chain and were never settled (stranded GAS). This
    /// contract settles the roll ON-CHAIN with Runtime.GetRandom and pays a winner
    /// 5.70x ATOMICALLY in the same transaction, out of a house bankroll. No external
    /// settler, no pending bet, no stranding.
    ///
    /// MODEL: the house funds a bankroll (GAS memo "miniapp-dice-game:fund"). A player
    /// prepays a wager (GAS memo "miniapp-dice-game:stake") then calls roll(player, face,
    /// amount) choosing a face in [1,6]. A bet is only accepted when the bankroll can
    /// cover the extra-from-house a win pays (bankroll >= amount*47/10), so EVERY win is
    /// fully payable — a roll never reverts for lack of funds.
    ///
    /// PAYOUT / EDGE: a win pays 5.70x the wager (amount*57/10). A fair 1/6 game would
    /// pay 6x; paying 5.70x leaves the house a 5% edge ((6 - 5.7)/6 = 0.05). On a win
    /// the house tops up the wager with the extra amount*47/10 (= payout - amount); on a
    /// loss the wager is added to the bankroll.
    ///
    /// RANDOMNESS: Runtime.GetRandom() (per-block consensus beacon, unknown until the tx
    /// mines) mixed with the player + Runtime.Time + game id, reduced to [1,6]. The
    /// outcome is decided in the SAME tx as the wager, so a player cannot see it and
    /// abort — there is no abort-and-retry. NOT VRF-grade; a block producer has some
    /// influence, so this is intended for low-stakes play (hence MAX_BET is capped).
    ///
    /// SAFETY: GAS only, BASE UNITS (1 GAS = 1e8). Deposit-then-roll. Checks-effects-
    /// interactions: bankroll + stats + game record are written before the payout
    /// transfer; a failed transfer asserts and reverts the whole atomic invocation.
    /// </summary>
    [DisplayName("MiniAppDiceGame")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain 6-sided dice: 5.70x payout settled with Runtime.GetRandom from a house bankroll — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppDiceGame : SmartContract
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
        [DisplayName("Rolled")]
        public static event Action<BigInteger, UInt160, BigInteger, BigInteger, bool, BigInteger> OnRolled; // gameId, player, face, rolled, won, payout
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
        public struct Game
        {
            public UInt160 Player;
            public BigInteger Face;     // chosen face, 1..6
            public BigInteger Rolled;   // rolled face, 1..6
            public bool Won;
            public BigInteger Wager;
            public BigInteger Payout;   // amount*57/10 on win, 0 on loss
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

        #region Roll
        /// <summary>
        /// Settle a 6-sided dice roll for the player's prepaid wager. face: 1..6.
        /// On a win the player is paid 5.70x atomically; on a loss the wager funds the bankroll.
        /// Returns the rolled face (1..6).
        /// </summary>
        public static BigInteger Roll(UInt160 player, BigInteger face, BigInteger amount)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");
            ExecutionEngine.Assert(face >= 1 && face <= 6, "face must be 1..6");
            ExecutionEngine.Assert(amount >= MIN_BET && amount <= MAX_BET, "bet out of range");

            StorageContext ctx = Storage.CurrentContext;

            // Consume the prepaid wager.
            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= amount, "insufficient bet credit");
            BigInteger nextCredit = credit - amount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            // The bankroll must cover the extra a win pays beyond the wager
            // (payout - amount = amount*47/10), so a win is always fully payable.
            BigInteger extra = amount * EXTRA_NUM / PAYOUT_DEN;
            BigInteger bankroll = (BigInteger)Storage.Get(ctx, PREFIX_BANKROLL);
            ExecutionEngine.Assert(bankroll >= extra, "bankroll cannot cover this bet");

            // Outcome from the per-block beacon mixed with player + time + game id, reduced to [1,6].
            BigInteger gameId = (BigInteger)Storage.Get(ctx, PREFIX_GAME_ID) + 1;
            Storage.Put(ctx, PREFIX_GAME_ID, gameId);
            BigInteger entropy = Runtime.GetRandom();
            if (entropy < 0) entropy = -entropy;
            BigInteger mix = (BigInteger)(ByteString)(byte[])player + Runtime.Time + gameId;
            if (mix < 0) mix = -mix;
            BigInteger rolled = (entropy + mix) % 6 + 1;
            bool won = rolled == face;

            Stats s = LoadStats(ctx, player);
            BigInteger payout = 0;
            if (won)
            {
                payout = amount * PAYOUT_NUM / PAYOUT_DEN;
                bankroll -= extra;        // pay the extra-from-house
                s.Wins += 1;
                s.TotalWon += extra;      // player's net profit
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
                Player = player, Face = face, Rolled = rolled, Won = won,
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

            OnRolled(gameId, player, face, rolled, won, payout);
            return rolled;
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

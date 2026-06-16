using System;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppGasBoxV2 : SmartContract
    {
        #region Commit (block N: irrevocably take the wager + reserve the worst-case prize)
        /// <summary>
        /// Commit a pull on an active machine. The wager (machine price) is consumed
        /// from the player's prepaid play credit and ESCROWED, and the machine's
        /// worst-case prize (MaxPrize) is RESERVED from the prize pool. The outcome is
        /// NOT decided here — it is drawn in a strictly later block by settle(). Because
        /// the wager commits now (block N) and settle is permissionless, the player
        /// cannot read the result and abort to dodge a loss. Returns the betId.
        /// </summary>
        public static BigInteger Commit(BigInteger machineId, UInt160 player)
        {
            ExecutionEngine.Assert(player is not null && player.IsValid && !player.IsZero, "invalid player");
            ExecutionEngine.Assert(Runtime.CheckWitness(player), "player witness required");

            StorageContext ctx = Storage.CurrentContext;
            Machine m = LoadMachine(machineId);
            ExecutionEngine.Assert(m.Active, "machine not active");

            // Consume the play price from the player's prepaid credit (escrow the wager).
            byte[] creditKey = Helper.Concat(PREFIX_PLAY_CREDIT, (byte[])player);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= m.Price, "insufficient play credit");
            BigInteger nextCredit = credit - m.Price;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            // Reserve the worst-case prize so concurrent pending pulls can never
            // oversubscribe the pool: every accepted commit is fully payable.
            ExecutionEngine.Assert(m.PoolBalance - m.ReservedPool >= m.MaxPrize, "free pool cannot cover max prize");
            m.ReservedPool += m.MaxPrize;
            // Auto-deactivate once the remaining free pool can no longer cover another
            // worst-case prize (mirrors V1's "always payable" guarantee).
            if (m.PoolBalance - m.ReservedPool < m.MaxPrize) m.Active = false;
            Storage.Put(ctx, MachineKey(machineId), StdLib.Serialize(m));

            BigInteger betId = (BigInteger)Storage.Get(ctx, PREFIX_BET_ID) + 1;
            Storage.Put(ctx, PREFIX_BET_ID, betId);
            PendingBet bet = new PendingBet
            {
                MachineId = machineId,
                Player = player,
                Wager = m.Price,
                Reserved = m.MaxPrize,
                CommitIndex = Ledger.CurrentIndex,
                Settled = false,
            };
            Storage.Put(ctx, BetKey(betId), StdLib.Serialize(bet));
            BigInteger pending = (BigInteger)Storage.Get(ctx, PREFIX_PENDING_CNT) + 1;
            Storage.Put(ctx, PREFIX_PENDING_CNT, pending);

            OnCommitted(betId, machineId, player, bet.Wager, bet.CommitIndex);
            return betId;
        }
        #endregion

        #region Settle (block > N: reveal the weighted draw and pay atomically) — PERMISSIONLESS
        /// <summary>
        /// Reveal and settle a committed pull. Anyone may call this (a keeper or the
        /// frontend), so a player cannot withhold a small-prize settlement. The reveal
        /// MUST happen in a strictly later block than the commit, so the GetRandom beacon
        /// used to draw the prize was unknown when the wager committed. On settle: the
        /// weighted prize is drawn, paid to the player from the reserved pool, the escrowed
        /// wager becomes machine revenue, and the MaxPrize reservation is released.
        /// Returns the chosen item index.
        /// </summary>
        public static BigInteger Settle(BigInteger betId)
        {
            StorageContext ctx = Storage.CurrentContext;
            PendingBet bet = LoadBet(betId);
            ExecutionEngine.Assert(!bet.Settled, "already settled");
            // The reveal block must be strictly later than the commit block, which also
            // guarantees the beacon block (commitIndex+1) exists.
            ExecutionEngine.Assert(Ledger.CurrentIndex > bet.CommitIndex, "reveal must be a later block");

            Machine m = LoadMachine(bet.MachineId);

            // Weighted selection from a FIXED beacon — the hash of block commitIndex+1
            // (unknown at commit, immutable once produced) — mixed with the bet's identity
            // (betId + player + commitIndex). Because the beacon is a fixed past block,
            // re-calling settle in ANY later block yields the SAME draw, so a player cannot
            // abort an unfavourable settle via a wrapper contract and retry to grind for the
            // jackpot. An earlier design drew from Runtime.GetRandom() at settle, which
            // re-rolled every block and did NOT close that abort-and-retry exploit.
            var beacon = Ledger.GetBlock((uint)(bet.CommitIndex + 1));
            ExecutionEngine.Assert(beacon is not null, "beacon block unavailable");
            BigInteger entropy = (BigInteger)(ByteString)(byte[])beacon.Hash;
            if (entropy < 0) entropy = -entropy;
            BigInteger mix = (BigInteger)(ByteString)(byte[])bet.Player + betId + bet.CommitIndex;
            if (mix < 0) mix = -mix;
            BigInteger roll = (entropy + mix) % m.TotalWeight;

            BigInteger chosenIndex = 1;
            BigInteger acc = 0;
            BigInteger prize = 0;
            for (BigInteger i = 1; i <= m.ItemCount; i++)
            {
                Item it = (Item)StdLib.Deserialize(Storage.Get(ctx, ItemKey(bet.MachineId, i)));
                acc += it.Weight;
                if (roll < acc) { chosenIndex = i; prize = it.Amount; break; }
            }

            // Effects: release the full MaxPrize reservation, deduct the actual prize from
            // the pool, bank the escrowed wager as revenue, mark settled.
            m.ReservedPool -= bet.Reserved;
            m.PoolBalance -= prize;
            m.Revenue += bet.Wager;
            // The machine may re-activate now that the reservation is released, as long as
            // the free pool can still cover a worst-case prize; otherwise it stays/locks
            // inactive (creator must refund the pool to resume).
            if (!m.Active && m.ItemCount > 0 && m.PoolBalance - m.ReservedPool >= m.MaxPrize) m.Active = true;
            else if (m.Active && m.PoolBalance - m.ReservedPool < m.MaxPrize) m.Active = false;
            Storage.Put(ctx, MachineKey(bet.MachineId), StdLib.Serialize(m));

            bet.Settled = true;
            Storage.Put(ctx, BetKey(betId), StdLib.Serialize(bet));
            BigInteger pending = (BigInteger)Storage.Get(ctx, PREFIX_PENDING_CNT) - 1;
            Storage.Put(ctx, PREFIX_PENDING_CNT, pending);

            // Interaction last. prize > 0 always (every item amount > 0), and the pool is
            // guaranteed to cover it by the commit-time reservation.
            bool ok = (bool)Contract.Call(m.PrizeAsset, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, bet.Player, prize, "" });
            ExecutionEngine.Assert(ok, "prize transfer failed");

            OnSettled(betId, bet.MachineId, bet.Player, chosenIndex, prize);
            return chosenIndex;
        }
        #endregion

        #region Withdraw credit
        /// <summary>Reclaim any unused prepaid play-credit back to the sender.</summary>
        public static BigInteger Withdraw(UInt160 account)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(account), "account witness required");
            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_PLAY_CREDIT, (byte[])account);
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

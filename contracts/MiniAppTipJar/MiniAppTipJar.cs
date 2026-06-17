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
    /// MiniAppTipJar — self-contained on-chain developer tip jar (NO oracle / OS kernel).
    ///
    /// WHY: the app previously routed tips through the OS PaymentProxy edge function
    /// (which moved nothing once the kernel degraded) and read a developer registry
    /// from OS StorageProxy that no contract ever wrote. This contract makes both the
    /// registry and the tip ledger authoritative and on-chain.
    ///
    /// MODEL (deposit-then-act, matching the platform's other standalone contracts):
    ///   1. A developer self-registers (registerDeveloper, under their own witness) and
    ///      gets a sequential devId. Their wallet can register only once.
    ///   2. A tipper deposits GAS with memo "miniapp-devtipping:tip" which credits their
    ///      tipper balance. tip(tipper, devId, amount, anonymous) then moves `amount`
    ///      from that credit to the developer's CLAIMABLE balance, bumps the developer's
    ///      lifetime totals, and records the tip (Tipped event, lag-free history source).
    ///   3. The developer withdraws their accrued balance (withdrawTips) to their wallet.
    ///   4. Any unused tipper credit (over/failed deposit) is reclaimable via Withdraw.
    ///
    /// No GAS is ever stranded: tips rest in the contract only as a developer's claimable
    /// balance (withdrawable by that developer) or as a tipper's reclaimable credit.
    /// </summary>
    [DisplayName("MiniAppTipJar")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Self-contained on-chain developer tip jar: registry + GAS tips that accrue to a claimable balance — no oracle.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "transfer")] // GAS
    public partial class MiniAppTipJar : SmartContract
    {
        #region Constants
        private const long MIN_TIP = 100_000;            // 0.001 GAS
        private const int MAX_NAME_LEN = 64;
        private const int MAX_ROLE_LEN = 64;
        private const string TIP_MEMO = "miniapp-devtipping:tip";
        #endregion

        #region Storage prefixes
        private static readonly byte[] PREFIX_DEV_COUNT = new byte[] { 0x10 };
        private static readonly byte[] PREFIX_DEV = new byte[] { 0x11 };          // + devId -> Developer
        private static readonly byte[] PREFIX_WALLET_DEV = new byte[] { 0x12 };   // + wallet -> devId
        private static readonly byte[] PREFIX_CREDIT = new byte[] { 0x13 };       // + tipper -> GAS credit
        private static readonly byte[] PREFIX_TOTAL_DONATED = new byte[] { 0x14 };
        private static readonly byte[] PREFIX_TIP_COUNT = new byte[] { 0x15 };
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x16 };
        #endregion

        #region Events
        [DisplayName("Credited")]
        public static event Action<UInt160, BigInteger, BigInteger> OnCredited; // tipper, amount, balance
        [DisplayName("DeveloperRegistered")]
        public static event Action<BigInteger, UInt160, string> OnDeveloperRegistered; // devId, wallet, name
        [DisplayName("Tipped")]
        public static event Action<BigInteger, BigInteger, UInt160, BigInteger, bool> OnTipped; // tipId, devId, tipper, amount, anonymous
        [DisplayName("TipsWithdrawn")]
        public static event Action<BigInteger, UInt160, BigInteger> OnTipsWithdrawn; // devId, wallet, amount
        [DisplayName("CreditWithdrawn")]
        public static event Action<UInt160, BigInteger> OnCreditWithdrawn; // tipper, amount
        #endregion

        #region Types
        public struct Developer
        {
            public UInt160 Wallet;
            public string Name;
            public string Role;
            public BigInteger TotalReceived; // lifetime GAS tipped to this developer
            public BigInteger TipCount;      // number of tips received
            public BigInteger Balance;       // currently claimable GAS
        }
        #endregion

        #region Lifecycle / owner
        /// <summary>
        /// Captures the deployer as the contract owner on first deployment. The owner is
        /// never reset on update so an upgrade cannot silently hijack control.
        /// </summary>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, Runtime.Transaction.Sender);
        }

        /// <summary>The contract owner (deployer). Authorizes contract upgrades.</summary>
        [Safe]
        public static UInt160 GetOwner()
        {
            ByteString v = Storage.Get(Storage.CurrentContext, PREFIX_OWNER);
            return v is null ? UInt160.Zero : (UInt160)v;
        }

        /// <summary>Owner-gated, instant contract upgrade (no timelock).</summary>
        public static void Update(ByteString nef, string manifest)
        {
            ExecutionEngine.Assert(Runtime.CheckWitness(GetOwner()), "unauthorized");
            ContractManagement.Update(nef, manifest, new object[0]);
        }
        #endregion

        #region Deposit
        /// <summary>GAS with memo "miniapp-devtipping:tip" credits the sender's tip balance.</summary>
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            ExecutionEngine.Assert(Runtime.CallingScriptHash == GAS.Hash, "only GAS accepted");
            ExecutionEngine.Assert(amount > 0, "amount must be > 0");
            ExecutionEngine.Assert(data is not null, "memo required");
            ExecutionEngine.Assert((string)data == TIP_MEMO, "invalid memo");

            StorageContext ctx = Storage.CurrentContext;
            byte[] key = Helper.Concat(PREFIX_CREDIT, (byte[])from);
            BigInteger bal = (BigInteger)Storage.Get(ctx, key) + amount;
            Storage.Put(ctx, key, bal);
            OnCredited(from, amount, bal);
        }
        #endregion

        #region Register
        /// <summary>
        /// Self-register a developer wallet. The caller must be the wallet being
        /// registered, and each wallet can register at most once. Returns the new devId.
        /// </summary>
        public static BigInteger RegisterDeveloper(UInt160 wallet, string name, string role)
        {
            ExecutionEngine.Assert(wallet is not null && wallet.IsValid && !wallet.IsZero, "invalid wallet");
            ExecutionEngine.Assert(Runtime.CheckWitness(wallet), "wallet witness required");
            ExecutionEngine.Assert(name is not null && name.Length > 0 && name.Length <= MAX_NAME_LEN, "invalid name");
            ExecutionEngine.Assert(role is not null && role.Length <= MAX_ROLE_LEN, "invalid role");

            StorageContext ctx = Storage.CurrentContext;
            byte[] walletKey = Helper.Concat(PREFIX_WALLET_DEV, (byte[])wallet);
            ExecutionEngine.Assert(Storage.Get(ctx, walletKey) is null, "wallet already registered");

            BigInteger devId = (BigInteger)Storage.Get(ctx, PREFIX_DEV_COUNT) + 1;
            Storage.Put(ctx, PREFIX_DEV_COUNT, devId);
            Storage.Put(ctx, walletKey, devId);

            Developer dev = new Developer
            {
                Wallet = wallet, Name = name, Role = role,
                TotalReceived = 0, TipCount = 0, Balance = 0,
            };
            Storage.Put(ctx, DevKey(devId), StdLib.Serialize(dev));

            OnDeveloperRegistered(devId, wallet, name);
            return devId;
        }
        #endregion

        #region Tip
        /// <summary>
        /// Move `amount` from the tipper's prepaid credit to developer `devId`'s claimable
        /// balance. The tipper must witness the call. Returns the new tip id.
        /// </summary>
        public static BigInteger Tip(UInt160 tipper, BigInteger devId, BigInteger amount, bool anonymous)
        {
            ExecutionEngine.Assert(tipper is not null && tipper.IsValid && !tipper.IsZero, "invalid tipper");
            ExecutionEngine.Assert(Runtime.CheckWitness(tipper), "tipper witness required");
            ExecutionEngine.Assert(amount >= MIN_TIP, "tip below minimum");

            StorageContext ctx = Storage.CurrentContext;

            ByteString raw = Storage.Get(ctx, DevKey(devId));
            ExecutionEngine.Assert(raw is not null, "developer not found");
            Developer dev = (Developer)StdLib.Deserialize(raw);

            byte[] creditKey = Helper.Concat(PREFIX_CREDIT, (byte[])tipper);
            BigInteger credit = (BigInteger)Storage.Get(ctx, creditKey);
            ExecutionEngine.Assert(credit >= amount, "insufficient tip credit");

            // Effects before any external interaction (no transfer here, but keep CEI ordering).
            BigInteger nextCredit = credit - amount;
            if (nextCredit == 0) Storage.Delete(ctx, creditKey); else Storage.Put(ctx, creditKey, nextCredit);

            dev.TotalReceived += amount;
            dev.TipCount += 1;
            dev.Balance += amount;
            Storage.Put(ctx, DevKey(devId), StdLib.Serialize(dev));

            Storage.Put(ctx, PREFIX_TOTAL_DONATED, (BigInteger)Storage.Get(ctx, PREFIX_TOTAL_DONATED) + amount);

            BigInteger tipId = (BigInteger)Storage.Get(ctx, PREFIX_TIP_COUNT) + 1;
            Storage.Put(ctx, PREFIX_TIP_COUNT, tipId);

            OnTipped(tipId, devId, tipper, amount, anonymous);
            return tipId;
        }
        #endregion

        #region Withdraw tips (developer)
        /// <summary>Developer withdraws their accrued claimable balance to their wallet.</summary>
        public static BigInteger WithdrawTips(BigInteger devId)
        {
            StorageContext ctx = Storage.CurrentContext;
            ByteString raw = Storage.Get(ctx, DevKey(devId));
            ExecutionEngine.Assert(raw is not null, "developer not found");
            Developer dev = (Developer)StdLib.Deserialize(raw);

            ExecutionEngine.Assert(Runtime.CheckWitness(dev.Wallet), "developer witness required");
            BigInteger amount = dev.Balance;
            ExecutionEngine.Assert(amount > 0, "no claimable tips");

            dev.Balance = 0;
            Storage.Put(ctx, DevKey(devId), StdLib.Serialize(dev));

            bool ok = (bool)Contract.Call(GAS.Hash, "transfer", CallFlags.All,
                new object[] { Runtime.ExecutingScriptHash, dev.Wallet, amount, "" });
            ExecutionEngine.Assert(ok, "tips transfer failed");

            OnTipsWithdrawn(devId, dev.Wallet, amount);
            return amount;
        }
        #endregion

        #region Withdraw credit (tipper)
        /// <summary>Reclaim any unused prepaid tip-credit back to the sender.</summary>
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

        #region Internal
        private static byte[] DevKey(BigInteger id) => Helper.Concat(PREFIX_DEV, (byte[])(ByteString)id);
        #endregion
    }
}

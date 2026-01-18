using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Tip Methods

        public static BigInteger Tip(
            UInt160 tipper, BigInteger devId, BigInteger amount,
            string message, string tipperName, bool anonymous, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            DeveloperData dev = GetDeveloper(devId);
            ExecutionEngine.Assert(dev.Wallet != UInt160.Zero, "dev not found");
            ExecutionEngine.Assert(dev.Active, "dev not active");
            ExecutionEngine.Assert(amount >= MIN_TIP, "tip too small");
            ExecutionEngine.Assert(message.Length <= MAX_MESSAGE_LENGTH, "message too long");
            ExecutionEngine.Assert(tipperName.Length <= 64, "name too long");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(tipper), "unauthorized");

            ValidatePaymentReceipt(APP_ID, tipper, amount, receiptId);

            BigInteger tipTier = 0;
            if (amount >= GOLD_TIP) tipTier = 3;
            else if (amount >= SILVER_TIP) tipTier = 2;
            else if (amount >= BRONZE_TIP) tipTier = 1;

            string displayName = anonymous ? "Anonymous" :
                (tipperName.Length > 0 ? tipperName : tipper.ToAddress(53));

            BigInteger tipId = TotalTips() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TIP_ID, tipId);

            TipData tip = new TipData
            {
                Tipper = tipper,
                DevId = devId,
                Amount = amount,
                Message = message,
                TipperName = displayName,
                Timestamp = Runtime.Time,
                TipTier = tipTier,
                Anonymous = anonymous
            };
            StoreTip(tipId, tip);

            BigInteger previousTotal = dev.TotalReceived;
            dev.Balance += amount;
            dev.TotalReceived += amount;
            dev.TipCount += 1;
            dev.LastTipTime = Runtime.Time;
            StoreDeveloper(devId, dev);

            BigInteger globalTotal = TotalDonated();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_DONATED, globalTotal + amount);

            UpdateTipperStats(tipper, amount, devId);
            CheckDevMilestones(devId, previousTotal, dev.TotalReceived);
            CheckTipperBadges(tipper);
            CheckDevBadges(devId);

            OnTipSent(tipper, devId, amount, message, displayName);
            return tipId;
        }

        #endregion
    }
}

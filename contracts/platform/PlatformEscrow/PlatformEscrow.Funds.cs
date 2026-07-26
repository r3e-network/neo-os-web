using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformEscrowContract
    {
        public static void OnNEP17Payment(UInt160 from, BigInteger amount, object data)
        {
            UInt160 asset = Runtime.CallingScriptHash;
            ExecutionEngine.Assert(IsSupportedAsset(asset), "unsupported asset");
            ValidateAddress(from);
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            string appId = MiniAppCreditLedger.RequireFundingAppId(data);
            RequireRegistered(appId);
            MiniAppCreditLedger.Credit(
                (ByteString)CreditKey(appId, asset, from),
                (ByteString)CreditLiabilityKey(appId, asset),
                (ByteString)(asset == GAS.Hash
                    ? PREFIX_TOTAL_GAS_CREDIT_LIABILITY
                    : PREFIX_TOTAL_NEO_CREDIT_LIABILITY),
                amount);
            if (asset == GAS.Hash) OnGasCredited(appId, from, amount);
            else OnNeoCredited(appId, from, amount);
        }

        public static BigInteger WithdrawCredit(string appId, UInt160 payer, UInt160 asset, BigInteger amount)
        {
            RequireRegistered(appId);
            ValidateAddress(payer);
            ExecutionEngine.Assert(Runtime.CheckWitness(payer), "payer witness required");
            ExecutionEngine.Assert(IsSupportedAsset(asset) && amount > 0, "invalid credit withdrawal");
            ExecutionEngine.Assert(ReadCredit(appId, asset, payer) >= amount, "insufficient credit");
            AcquireAccountLock(appId, payer);
            ConsumeCredit(appId, asset, payer, amount);
            TransferAsset(asset, payer, amount);
            ReleaseAccountLock(appId, payer);
            OnCreditWithdrawn(appId, payer, asset, amount);
            return amount;
        }

    }
}

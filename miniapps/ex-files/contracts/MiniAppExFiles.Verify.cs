using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Verify Methods

        /// <summary>
        /// Verify a record (requires verification fee).
        /// </summary>
        public static void VerifyRecord(BigInteger recordId, UInt160 verifier, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);

            RecordData record = GetRecord(recordId);
            ExecutionEngine.Assert(record.Creator != UInt160.Zero, "record not found");
            ExecutionEngine.Assert(record.Active, "record inactive");
            ExecutionEngine.Assert(!record.Verified, "already verified");
            ExecutionEngine.Assert(record.Creator != verifier, "cannot self-verify");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(verifier), "unauthorized");

            ValidatePaymentReceipt(APP_ID, verifier, VERIFY_FEE, receiptId);

            record.Verified = true;
            record.Verifier = verifier;
            StoreRecord(recordId, record);

            // Update global verified count
            BigInteger totalVerified = TotalVerified();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_VERIFIED, totalVerified + 1);

        }

        #endregion
    }
}

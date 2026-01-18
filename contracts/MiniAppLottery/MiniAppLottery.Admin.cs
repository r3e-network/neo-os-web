using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppLottery
    {
        #region Admin Methods

        public static void InitiateDraw()
        {
            ValidateAdmin();
            ExecutionEngine.Assert(!IsDrawPending(), "draw already pending");

            BigInteger pool = PrizePool();
            ExecutionEngine.Assert(pool > 0, "no prize pool");

            BigInteger roundId = CurrentRound();
            BigInteger participantCount = GetParticipantCount(roundId);
            ExecutionEngine.Assert(participantCount >= MIN_PARTICIPANTS, "min participants not met");

            Storage.Put(Storage.CurrentContext, PREFIX_DRAW_PENDING, 1);

            ByteString payload = StdLib.Serialize(new object[] { roundId });
            BigInteger requestId = RequestRng(APP_ID, payload);
            StoreRequestData(requestId, (ByteString)roundId.ToByteArray());

            OnDrawInitiated(roundId, requestId);
        }

        #endregion
    }
}

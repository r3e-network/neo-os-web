using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class PlatformGovernanceContract
    {
        [Safe]
        public static BigInteger TotalProposals(string appId) => ReadInteger(AppKey(appId, PREFIX_PROPOSAL_COUNT));

        [Safe]
        public static BigInteger CreditOf(string appId, UInt160 payer) => ReadCredit(appId, payer);

        [Safe]
        public static BigInteger CreditLiabilityOf(string appId) => ReadInteger(AppKey(appId, PREFIX_TENANT_LIABILITY));

        [Safe]
        public static BigInteger VoteLiabilityOf(string appId) => ReadInteger(VoteLiabilityKey(appId));

        [Safe]
        public static BigInteger TotalVoteLiability() => ReadInteger(PREFIX_TOTAL_VOTE_LIABILITY);

        [Safe]
        public static bool HasVoted(string appId, BigInteger proposalId, UInt160 voter) =>
            Storage.Get(Storage.CurrentContext, VoteKey(appId, proposalId, voter)) != null;

        [Safe]
        public static object VoteOf(string appId, BigInteger proposalId, UInt160 voter)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, VoteKey(appId, proposalId, voter));
            if (raw == null) return null;
            object[] vote = (object[])StdLib.Deserialize(raw);
            Map<string, object> result = new Map<string, object>();
            result["amount"] = vote[0];
            result["support"] = vote[1];
            return result;
        }

        [Safe]
        public static object GetProposalDetails(string appId, BigInteger proposalId)
        {
            object[] proposal = ReadProposal(appId, proposalId);
            Map<string, object> result = new Map<string, object>();
            result["id"] = proposal[0];
            result["creator"] = proposal[1];
            result["proposalType"] = proposal[2];
            result["title"] = proposal[3];
            result["description"] = proposal[4];
            result["actionData"] = proposal[5];
            result["createdTime"] = proposal[6];
            result["endTime"] = proposal[7];
            result["yesAmount"] = proposal[8];
            result["noAmount"] = proposal[9];
            result["status"] = StatusName((BigInteger)proposal[10]);
            return result;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats(string appId)
        {
            Map<string, object> result = new Map<string, object>();
            result["totalProposals"] = TotalProposals(appId);
            result["creditLiability"] = CreditLiabilityOf(appId);
            result["voteLiability"] = VoteLiabilityOf(appId);
            result["minimumDurationSeconds"] = MinimumDurationOf(appId);
            result["maximumDurationSeconds"] = MaximumDurationOf(appId);
            result["quorum"] = QuorumOf(appId);
            result["thresholdBps"] = ThresholdBpsOf(appId);
            return result;
        }

        private static string StatusName(BigInteger status)
        {
            if (status == 1) return "active";
            if (status == 2) return "passed";
            if (status == 3) return "rejected";
            if (status == 4) return "revoked";
            return "executed";
        }
    }
}

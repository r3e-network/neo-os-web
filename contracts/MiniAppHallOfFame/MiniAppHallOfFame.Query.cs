using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppHallOfFame
    {
        #region Nominee Query

        [Safe]
        public static Map<string, object> GetNomineeDetails(string category, string nominee)
        {
            Nominee nom = GetNominee(category, nominee);
            Map<string, object> details = new Map<string, object>();
            if (nom.AddedBy == UInt160.Zero) return details;

            details["name"] = nom.Name;
            details["category"] = nom.Category;
            details["description"] = nom.Description;
            details["addedBy"] = nom.AddedBy;
            details["addedTime"] = nom.AddedTime;
            details["totalVotes"] = nom.TotalVotes;
            details["voteCount"] = nom.VoteCount;
            details["inducted"] = nom.Inducted;

            return details;
        }

        #endregion
    }
}

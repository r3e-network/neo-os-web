using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppExFiles
    {
        #region Platform Query Methods

        [Safe]
        public static Map<string, object> GetRecordDetails(BigInteger recordId)
        {
            RecordData record = GetRecord(recordId);
            Map<string, object> details = new Map<string, object>();
            if (record.Creator == UInt160.Zero) return details;

            details["id"] = recordId;
            details["creator"] = record.Creator;
            details["rating"] = record.Rating;
            details["category"] = record.Category;
            details["queryCount"] = record.QueryCount;
            details["createTime"] = record.CreateTime;
            details["updateTime"] = record.UpdateTime;
            details["active"] = record.Active;
            details["verified"] = record.Verified;
            details["reportCount"] = record.ReportCount;

            if (record.Verified)
            {
                details["verifier"] = record.Verifier;
            }

            return details;
        }

        #endregion
    }
}

using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSoulboundCertificate
    {
        #region NEP-11 Read Methods

        [DisplayName("symbol")]
        [Safe]
        public static string Symbol() => TOKEN_SYMBOL;

        [DisplayName("decimals")]
        [Safe]
        public static byte Decimals() => TOKEN_DECIMALS;

        [DisplayName("totalSupply")]
        [Safe]
        public static BigInteger TotalSupply() => TotalCertificates();

        [DisplayName("balanceOf")]
        [Safe]
        public static BigInteger BalanceOf(UInt160 owner)
        {
            ValidateAddress(owner);
            return GetBalance(owner);
        }

        [DisplayName("ownerOf")]
        [Safe]
        public static UInt160 OwnerOf(ByteString tokenId)
        {
            return GetTokenOwner(tokenId);
        }

        [DisplayName("tokens")]
        [Safe]
        public static Iterator Tokens()
        {
            return Storage.Find(Storage.CurrentContext, PREFIX_TOKENS, FindOptions.ValuesOnly | FindOptions.RemovePrefix);
        }

        [DisplayName("tokensOf")]
        [Safe]
        public static Iterator TokensOf(UInt160 owner)
        {
            ValidateAddress(owner);
            return Storage.Find(
                Storage.CurrentContext,
                Helper.Concat(PREFIX_OWNER_TOKEN_LIST, owner),
                FindOptions.ValuesOnly | FindOptions.RemovePrefix);
        }

        [DisplayName("properties")]
        [Safe]
        public static Map<string, object> Properties(ByteString tokenId)
        {
            CertificateData cert = GetCertificate(tokenId);
            Map<string, object> props = new Map<string, object>();
            if (cert.TemplateId <= 0) return props;

            TemplateData data = GetTemplate(cert.TemplateId);
            props["tokenId"] = tokenId;
            props["templateId"] = cert.TemplateId;
            props["templateName"] = data.Name;
            props["issuerName"] = data.IssuerName;
            props["category"] = data.Category;
            props["description"] = data.Description;
            props["recipientName"] = cert.RecipientName;
            props["achievement"] = cert.Achievement;
            props["memo"] = cert.Memo;
            props["issuedTime"] = cert.IssuedTime;
            props["revoked"] = cert.Revoked;
            props["revokedTime"] = cert.RevokedTime;
            return props;
        }

        #endregion

        #region App Queries

        [Safe]
        public static Map<string, object> GetTemplateDetails(BigInteger templateId)
        {
            TemplateData data = GetTemplate(templateId);
            Map<string, object> details = new Map<string, object>();
            if (data.Issuer == UInt160.Zero) return details;

            details["id"] = templateId;
            details["issuer"] = data.Issuer;
            details["name"] = data.Name;
            details["issuerName"] = data.IssuerName;
            details["category"] = data.Category;
            details["maxSupply"] = data.MaxSupply;
            details["issued"] = data.Issued;
            details["description"] = data.Description;
            details["active"] = data.Active;
            details["createdTime"] = data.CreatedTime;
            details["status"] = data.Active ? "active" : "inactive";
            return details;
        }

        [Safe]
        public static Map<string, object> GetCertificateDetails(ByteString tokenId)
        {
            CertificateData cert = GetCertificate(tokenId);
            Map<string, object> details = new Map<string, object>();
            if (cert.TemplateId <= 0) return details;

            TemplateData data = GetTemplate(cert.TemplateId);
            details["tokenId"] = tokenId;
            details["templateId"] = cert.TemplateId;
            details["owner"] = cert.Owner;
            details["templateName"] = data.Name;
            details["issuerName"] = data.IssuerName;
            details["category"] = data.Category;
            details["description"] = data.Description;
            details["recipientName"] = cert.RecipientName;
            details["achievement"] = cert.Achievement;
            details["memo"] = cert.Memo;
            details["issuedTime"] = cert.IssuedTime;
            details["revoked"] = cert.Revoked;
            details["revokedTime"] = cert.RevokedTime;
            details["active"] = data.Active;
            return details;
        }

        [Safe]
        public static BigInteger GetIssuerTemplateCount(UInt160 issuer)
        {
            return GetIssuerTemplateCountInternal(issuer);
        }

        [Safe]
        public static BigInteger[] GetIssuerTemplates(UInt160 issuer, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetIssuerTemplateCountInternal(issuer);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_ISSUER_TEMPLATES, issuer),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalTemplates"] = TotalTemplates();
            stats["totalCertificates"] = TotalCertificates();
            stats["maxSupply"] = MAX_SUPPLY;
            stats["maxNameLength"] = MAX_NAME_LENGTH;
            stats["maxIssuerNameLength"] = MAX_ISSUER_NAME_LENGTH;
            return stats;
        }

        #endregion
    }
}

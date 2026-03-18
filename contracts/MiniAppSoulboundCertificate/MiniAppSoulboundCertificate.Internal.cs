using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSoulboundCertificate
    {
        #region Internal Helpers

        private static void StoreTemplate(BigInteger templateId, TemplateData data)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TEMPLATES, (ByteString)templateId.ToByteArray()),
                StdLib.Serialize(data));
        }

        private static void StoreCertificate(ByteString tokenId, CertificateData data)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CERTIFICATES, tokenId),
                StdLib.Serialize(data));
        }

        private static void AddIssuerTemplate(UInt160 issuer, BigInteger templateId)
        {
            byte[] countKey = Helper.Concat(PREFIX_ISSUER_TEMPLATE_COUNT, issuer);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_ISSUER_TEMPLATES, issuer),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, templateId);
        }

        private static BigInteger GetIssuerTemplateCountInternal(UInt160 issuer)
        {
            byte[] key = Helper.Concat(PREFIX_ISSUER_TEMPLATE_COUNT, issuer);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static void ValidateTemplateText(string name, string issuerName, string category, string description)
        {
            ExecutionEngine.Assert(name != null && name.Length > 0, "name required");
            ExecutionEngine.Assert(name.Length <= MAX_NAME_LENGTH, "name too long");
            if (issuerName != null)
            {
                ExecutionEngine.Assert(issuerName.Length <= MAX_ISSUER_NAME_LENGTH, "issuer name too long");
            }
            if (category != null)
            {
                ExecutionEngine.Assert(category.Length <= MAX_CATEGORY_LENGTH, "category too long");
            }
            if (description != null)
            {
                ExecutionEngine.Assert(description.Length <= MAX_DESCRIPTION_LENGTH, "description too long");
            }
        }

        private static void ValidateCertificateText(string recipientName, string achievement, string memo)
        {
            if (recipientName != null)
            {
                ExecutionEngine.Assert(recipientName.Length <= MAX_RECIPIENT_NAME_LENGTH, "recipient too long");
            }
            if (achievement != null)
            {
                ExecutionEngine.Assert(achievement.Length <= MAX_ACHIEVEMENT_LENGTH, "achievement too long");
            }
            if (memo != null)
            {
                ExecutionEngine.Assert(memo.Length <= MAX_MEMO_LENGTH, "memo too long");
            }
        }

        private static ByteString BuildTokenId(BigInteger templateId, BigInteger serial)
        {
            return (ByteString)(templateId.ToString() + "-" + serial.ToString());
        }

        private static UInt160 GetTokenOwner(ByteString tokenId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_TOKEN_OWNER, tokenId));
            if (data == null) return UInt160.Zero;
            return (UInt160)data;
        }

        private static void PutTokenOwner(ByteString tokenId, UInt160 owner)
        {
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_TOKEN_OWNER, tokenId), owner);
        }

        private static BigInteger GetBalance(UInt160 owner)
        {
            ByteString data = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_OWNER_BALANCE, owner));
            return data == null ? 0 : (BigInteger)data;
        }

        private static void UpdateBalance(UInt160 owner, BigInteger delta)
        {
            BigInteger current = GetBalance(owner);
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_OWNER_BALANCE, owner), current + delta);
        }

        private static void AddTokenToOwner(UInt160 owner, ByteString tokenId)
        {
            byte[] countKey = Helper.Concat(PREFIX_OWNER_TOKEN_COUNT, owner);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_OWNER_TOKEN_LIST, owner),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, tokenId);
        }

        private static void RegisterToken(ByteString tokenId)
        {
            BigInteger total = TotalCertificates();
            byte[] key = Helper.Concat(PREFIX_TOKENS, (ByteString)total.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, tokenId);
        }

        private static void IncreaseTotalSupply(BigInteger delta)
        {
            BigInteger current = TotalCertificates();
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY, current + delta);
        }

        private static void MintToken(UInt160 to, ByteString tokenId)
        {
            ExecutionEngine.Assert(GetTokenOwner(tokenId) == UInt160.Zero, "token exists");

            PutTokenOwner(tokenId, to);
            AddTokenToOwner(to, tokenId);
            UpdateBalance(to, 1);
            RegisterToken(tokenId);
            IncreaseTotalSupply(1);

            OnTransfer(UInt160.Zero, to, tokenId);
        }

        #endregion
    }
}

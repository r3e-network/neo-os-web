using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppSoulboundCertificate
    {
        #region User Methods

        /// <summary>
        /// Creates a new certificate template.
        /// </summary>
        public static BigInteger CreateTemplate(
            UInt160 issuer,
            string name,
            string issuerName,
            string category,
            BigInteger maxSupply,
            string description)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(issuer);
            ValidateTemplateText(name, issuerName, category, description);

            ExecutionEngine.Assert(maxSupply > 0 && maxSupply <= MAX_SUPPLY, "invalid max supply");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(issuer), "unauthorized");

            BigInteger templateId = TotalTemplates() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_TEMPLATE_ID, templateId);

            TemplateData data = new TemplateData
            {
                Issuer = issuer,
                Name = name,
                IssuerName = issuerName,
                Category = category,
                MaxSupply = maxSupply,
                Issued = 0,
                Description = description,
                Active = true,
                CreatedTime = Runtime.Time
            };

            StoreTemplate(templateId, data);
            AddIssuerTemplate(issuer, templateId);

            OnTemplateCreated(templateId, issuer, name);
            return templateId;
        }

        /// <summary>
        /// Updates template metadata (issuer-only).
        /// </summary>
        public static void UpdateTemplate(
            UInt160 issuer,
            BigInteger templateId,
            string name,
            string issuerName,
            string category,
            BigInteger maxSupply,
            string description)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(issuer);
            ValidateTemplateText(name, issuerName, category, description);

            TemplateData data = GetTemplate(templateId);
            ExecutionEngine.Assert(data.Issuer != UInt160.Zero, "template not found");
            ExecutionEngine.Assert(data.Issuer == issuer, "not issuer");
            ExecutionEngine.Assert(maxSupply >= data.Issued && maxSupply <= MAX_SUPPLY, "invalid max supply");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(issuer), "unauthorized");

            data.Name = name;
            data.IssuerName = issuerName;
            data.Category = category;
            data.MaxSupply = maxSupply;
            data.Description = description;

            StoreTemplate(templateId, data);
            OnTemplateUpdated(templateId);
        }

        /// <summary>
        /// Toggles template active state (issuer-only).
        /// </summary>
        public static void SetTemplateActive(UInt160 issuer, BigInteger templateId, bool active)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(issuer);

            TemplateData data = GetTemplate(templateId);
            ExecutionEngine.Assert(data.Issuer != UInt160.Zero, "template not found");
            ExecutionEngine.Assert(data.Issuer == issuer, "not issuer");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(issuer), "unauthorized");

            data.Active = active;
            StoreTemplate(templateId, data);
            OnTemplateUpdated(templateId);
        }

        /// <summary>
        /// Issues a soulbound certificate for a template.
        /// </summary>
        public static ByteString IssueCertificate(
            UInt160 issuer,
            UInt160 recipient,
            BigInteger templateId,
            string recipientName,
            string achievement,
            string memo)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(issuer);
            ValidateAddress(recipient);
            ValidateCertificateText(recipientName, achievement, memo);

            TemplateData data = GetTemplate(templateId);
            ExecutionEngine.Assert(data.Issuer != UInt160.Zero, "template not found");
            ExecutionEngine.Assert(data.Active, "template inactive");
            ExecutionEngine.Assert(data.Issuer == issuer, "not issuer");
            ExecutionEngine.Assert(data.Issued < data.MaxSupply, "supply exceeded");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(issuer), "unauthorized");

            BigInteger serial = data.Issued + 1;
            ByteString tokenId = BuildTokenId(templateId, serial);
            MintToken(recipient, tokenId);

            CertificateData cert = new CertificateData
            {
                TemplateId = templateId,
                Owner = recipient,
                IssuedTime = Runtime.Time,
                Revoked = false,
                RevokedTime = 0,
                RecipientName = recipientName,
                Achievement = achievement,
                Memo = memo
            };
            StoreCertificate(tokenId, cert);

            data.Issued = serial;
            StoreTemplate(templateId, data);

            OnCertificateIssued(tokenId, templateId, recipient);
            return tokenId;
        }

        /// <summary>
        /// Revokes a certificate (issuer-only).
        /// </summary>
        public static void RevokeCertificate(UInt160 issuer, ByteString tokenId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(issuer);

            CertificateData cert = GetCertificate(tokenId);
            ExecutionEngine.Assert(cert.TemplateId > 0, "certificate not found");

            TemplateData data = GetTemplate(cert.TemplateId);
            ExecutionEngine.Assert(data.Issuer != UInt160.Zero, "template not found");
            ExecutionEngine.Assert(data.Issuer == issuer, "not issuer");
            ExecutionEngine.Assert(!cert.Revoked, "already revoked");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(issuer), "unauthorized");

            cert.Revoked = true;
            cert.RevokedTime = Runtime.Time;
            StoreCertificate(tokenId, cert);

            OnCertificateRevoked(tokenId, cert.TemplateId, issuer);
        }

        /// <summary>
        /// NEP-11 Transfer (soulbound, non-transferable).
        /// </summary>
        public static bool Transfer(UInt160 from, UInt160 to, ByteString tokenId, object data)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(from);
            ValidateAddress(to);

            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");
            ExecutionEngine.Assert(GetTokenOwner(tokenId) == from, "not owner");

            if (from == to)
            {
                return true;
            }

            ExecutionEngine.Assert(false, "non-transferable");
            return false;
        }

        #endregion
    }
}

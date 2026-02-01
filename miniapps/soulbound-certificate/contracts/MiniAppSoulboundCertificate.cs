using System;
using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// SoulboundCertificate MiniApp - Non-transferable NEP-11 credentials.
    ///
    /// KEY FEATURES:
    /// - Create certificate templates with max supply
    /// - Issue non-transferable NEP-11 certificates
    /// - Revoke certificates if needed
    /// - Categories for different credential types
    /// - Issuer verification system
    /// - Permanent on-chain credentials
    ///
    /// SECURITY:
    /// - Non-transferable enforcement
    /// - Only issuer can revoke
    /// - Supply limit enforcement
    /// - Issuer authorization
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for issuance fees
    /// - NEP-11 token operations
    /// </summary>
    [DisplayName("MiniAppSoulboundCertificate")]
    [SupportedStandards("NEP-11")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "SoulboundCertificate issues non-transferable NEP-11 badges for permanent credentials.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppSoulboundCertificate : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the SoulboundCertificate miniapp.</summary>
        private const string APP_ID = "miniapp-soulbound-certificate";
        
        /// <summary>Token symbol for certificates.</summary>
        private const string TOKEN_SYMBOL = "CERT";
        
        /// <summary>Token decimals (0 for NFT).</summary>
        private const byte TOKEN_DECIMALS = 0;
        
        /// <summary>Maximum certificate name length.</summary>
        private const int MAX_NAME_LENGTH = 60;
        
        /// <summary>Maximum issuer name length.</summary>
        private const int MAX_ISSUER_NAME_LENGTH = 60;
        
        /// <summary>Maximum category length.</summary>
        private const int MAX_CATEGORY_LENGTH = 32;
        
        /// <summary>Maximum description length.</summary>
        private const int MAX_DESCRIPTION_LENGTH = 240;
        
        /// <summary>Maximum recipient name length.</summary>
        private const int MAX_RECIPIENT_NAME_LENGTH = 60;
        
        /// <summary>Maximum achievement text length.</summary>
        private const int MAX_ACHIEVEMENT_LENGTH = 120;
        
        /// <summary>Maximum memo length.</summary>
        private const int MAX_MEMO_LENGTH = 160;
        
        /// <summary>Maximum supply per template.</summary>
        private const int MAX_SUPPLY = 100000;
        #endregion

        #region Storage Prefixes (0x20+)
        /// <summary>Prefix 0x20: Current template ID counter.</summary>
        private static readonly byte[] PREFIX_TEMPLATE_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Template data storage.</summary>
        private static readonly byte[] PREFIX_TEMPLATES = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: Issuer template list.</summary>
        private static readonly byte[] PREFIX_ISSUER_TEMPLATES = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: Issuer template count.</summary>
        private static readonly byte[] PREFIX_ISSUER_TEMPLATE_COUNT = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Certificate data storage.</summary>
        private static readonly byte[] PREFIX_CERTIFICATES = new byte[] { 0x24 };

        // NEP-11 storage prefixes
        /// <summary>Prefix 0x30: Total token supply.</summary>
        private static readonly byte[] PREFIX_TOTAL_SUPPLY = new byte[] { 0x30 };
        
        /// <summary>Prefix 0x31: Token to owner mapping.</summary>
        private static readonly byte[] PREFIX_TOKEN_OWNER = new byte[] { 0x31 };
        
        /// <summary>Prefix 0x32: Owner balance.</summary>
        private static readonly byte[] PREFIX_OWNER_BALANCE = new byte[] { 0x32 };
        
        /// <summary>Prefix 0x33: Owner token count.</summary>
        private static readonly byte[] PREFIX_OWNER_TOKEN_COUNT = new byte[] { 0x33 };
        
        /// <summary>Prefix 0x34: Owner token list.</summary>
        private static readonly byte[] PREFIX_OWNER_TOKEN_LIST = new byte[] { 0x34 };
        
        /// <summary>Prefix 0x35: Token metadata.</summary>
        private static readonly byte[] PREFIX_TOKENS = new byte[] { 0x35 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Certificate template structure.
        /// FIELDS:
        /// - Issuer: Template creator address
        /// - Name: Template name
        /// - IssuerName: Display name of issuer
        /// - Category: Certificate category
        /// - MaxSupply: Maximum certificates issuable
        /// - Issued: Certificates issued so far
        /// - Description: Template description
        /// - Active: Whether template is active
        /// - CreatedTime: Creation timestamp
        /// </summary>
        public struct TemplateData
        {
            public UInt160 Issuer;
            public string Name;
            public string IssuerName;
            public string Category;
            public BigInteger MaxSupply;
            public BigInteger Issued;
            public string Description;
            public bool Active;
            public BigInteger CreatedTime;
        }

        /// <summary>
        /// Certificate data structure.
        /// FIELDS:
        /// - TemplateId: Associated template
        /// - Owner: Certificate holder
        /// - IssuedTime: Issue timestamp
        /// - Revoked: Whether revoked
        /// - RevokedTime: Revocation timestamp
        /// - RecipientName: Name of recipient
        /// - Achievement: Achievement description
        /// - Memo: Additional memo
        /// </summary>
        public struct CertificateData
        {
            public BigInteger TemplateId;
            public UInt160 Owner;
            public BigInteger IssuedTime;
            public bool Revoked;
            public BigInteger RevokedTime;
            public string RecipientName;
            public string Achievement;
            public string Memo;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when template is created.</summary>
        /// <param name="templateId">New template identifier.</param>
        /// <param name="issuer">Creator address.</param>
        /// <param name="name">Template name.</param>
        public delegate void TemplateCreatedHandler(BigInteger templateId, UInt160 issuer, string name);
        
        /// <summary>Event emitted when template is updated.</summary>
        /// <param name="templateId">Template identifier.</param>
        public delegate void TemplateUpdatedHandler(BigInteger templateId);
        
        /// <summary>Event emitted when certificate is issued.</summary>
        /// <param name="tokenId">Certificate token ID.</param>
        /// <param name="templateId">Template identifier.</param>
        /// <param name="owner">Certificate owner.</param>
        public delegate void CertificateIssuedHandler(ByteString tokenId, BigInteger templateId, UInt160 owner);
        
        /// <summary>Event emitted when certificate is revoked.</summary>
        /// <param name="tokenId">Certificate token ID.</param>
        /// <param name="templateId">Template identifier.</param>
        /// <param name="issuer">Revoking issuer.</param>
        public delegate void CertificateRevokedHandler(ByteString tokenId, BigInteger templateId, UInt160 issuer);
        
        /// <summary>Event emitted when token is transferred (enforced non-transferable).</summary>
        /// <param name="from">Previous owner (always zero).</param>
        /// <param name="to">New owner.</param>
        /// <param name="tokenId">Token ID.</param>
        public delegate void TransferHandler(UInt160 from, UInt160 to, ByteString tokenId);
        #endregion

        #region Events
        [DisplayName("TemplateCreated")]
        public static event TemplateCreatedHandler OnTemplateCreated;

        [DisplayName("TemplateUpdated")]
        public static event TemplateUpdatedHandler OnTemplateUpdated;

        [DisplayName("CertificateIssued")]
        public static event CertificateIssuedHandler OnCertificateIssued;

        [DisplayName("CertificateRevoked")]
        public static event CertificateRevokedHandler OnCertificateRevoked;

        [DisplayName("Transfer")]
        public static event TransferHandler OnTransfer;
        #endregion

        #region Lifecycle
        /// <summary>
        /// Contract deployment initialization.
        /// </summary>
        /// <param name="data">Deployment data (unused).</param>
        /// <param name="update">True if this is a contract update.</param>
        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TEMPLATE_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY, 0);
        }
        #endregion

        #region Core Read Methods
        /// <summary>
        /// Gets total templates created.
        /// </summary>
        /// <returns>Total template count.</returns>
        [Safe]
        public static BigInteger TotalTemplates() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TEMPLATE_ID);

        /// <summary>
        /// Gets total certificates issued.
        /// </summary>
        /// <returns>Total certificate count.</returns>
        [Safe]
        public static BigInteger TotalCertificates() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY);

        /// <summary>
        /// Gets template data by ID.
        /// </summary>
        /// <param name="templateId">Template identifier.</param>
        /// <returns>Template data struct.</returns>
        [Safe]
        public static TemplateData GetTemplate(BigInteger templateId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TEMPLATES, (ByteString)templateId.ToByteArray()));
            if (data == null) return new TemplateData();
            return (TemplateData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets certificate data by token ID.
        /// </summary>
        /// <param name="tokenId">Certificate token ID.</param>
        /// <returns>Certificate data struct.</returns>
        [Safe]
        public static CertificateData GetCertificate(ByteString tokenId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_CERTIFICATES, tokenId));
            if (data == null) return new CertificateData();
            return (CertificateData)StdLib.Deserialize(data);
        }
        #endregion
    }
}

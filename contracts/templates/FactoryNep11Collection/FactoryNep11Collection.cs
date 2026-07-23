using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Templates
{
    public delegate void FactoryNep11TransferHandler(
        UInt160 from, UInt160 to, BigInteger amount, ByteString tokenId);
    public delegate void FactoryNep11OwnerChangedHandler(
        UInt160 previousOwner, UInt160 newOwner);
    public delegate void FactoryNep11PausedHandler(bool paused);

    [DisplayName("FactoryNep11Collection")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Governed parameterized non-divisible NEP-11 template for MiniAppFactory deployments.")]
    [SupportedStandards(NepStandard.Nep11)]
    [ContractPermission("*", "onNEP11Payment")]
    public partial class FactoryNep11Collection : SmartContract
    {
        private static readonly byte[] PREFIX_NAME = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SYMBOL = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_MAX_SUPPLY = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_TOTAL_SUPPLY = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_ROYALTY_BPS = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_BASE_URI = new byte[] { 0x06 };
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_TRANSFERABLE = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x09 };
        private static readonly byte[] PREFIX_CALLBACK_LOCK = new byte[] { 0x0A };
        private const byte PREFIX_TOKEN_OWNER = 0x20;
        private const byte PREFIX_OWNER_BALANCE = 0x21;
        private const byte PREFIX_OWNER_TOKEN = 0x22;

        private const int MAX_INIT_JSON_LENGTH = 4096;
        private const int MAX_NAME_LENGTH = 64;
        private const int MAX_SYMBOL_LENGTH = 12;
        private const int MAX_BASE_URI_LENGTH = 256;
        private const int MAX_TOKEN_ID_LENGTH = 64;

        [DisplayName("Transfer")]
        public static event FactoryNep11TransferHandler OnTransfer;
        [DisplayName("OwnerChanged")]
        public static event FactoryNep11OwnerChangedHandler OnOwnerChanged;
        [DisplayName("Paused")]
        public static event FactoryNep11PausedHandler OnPaused;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            string json = (string)data;
            ExecutionEngine.Assert(
                json != null && json.Length > 0 && json.Length <= MAX_INIT_JSON_LENGTH,
                "invalid init params");
            Map<string, object> init =
                (Map<string, object>)StdLib.JsonDeserialize(json);
            ExecutionEngine.Assert(init != null, "invalid init params");

            string name = (string)init["collectionName"];
            string symbol = (string)init["symbol"];
            BigInteger maxSupply = (BigInteger)init["maxSupply"];
            BigInteger royaltyBps = (BigInteger)init["royaltyBps"];
            string baseUri = (string)init["baseUri"];
            UInt160 owner = DecodeHash((string)init["ownerHashBase64"]);
            string transferPolicy = (string)init["transferPolicy"];

            ExecutionEngine.Assert(
                name != null && name.Length >= 3 && name.Length <= MAX_NAME_LENGTH,
                "invalid collection name");
            ExecutionEngine.Assert(IsValidSymbol(symbol), "invalid symbol");
            ExecutionEngine.Assert(maxSupply > 0 && maxSupply <= 1_000_000, "invalid max supply");
            ExecutionEngine.Assert(royaltyBps >= 0 && royaltyBps <= 1_000, "invalid royalty");
            ExecutionEngine.Assert(
                baseUri != null && baseUri.Length > 8 &&
                baseUri.Length <= MAX_BASE_URI_LENGTH && baseUri[baseUri.Length - 1] == '/',
                "invalid base uri");
            ExecutionEngine.Assert(
                transferPolicy == "transferable" || transferPolicy == "soulbound",
                "invalid transfer policy");

            Storage.Put(Storage.CurrentContext, PREFIX_NAME, name);
            Storage.Put(Storage.CurrentContext, PREFIX_SYMBOL, symbol);
            Storage.Put(Storage.CurrentContext, PREFIX_MAX_SUPPLY, maxSupply);
            Storage.Put(Storage.CurrentContext, PREFIX_ROYALTY_BPS, royaltyBps);
            Storage.Put(Storage.CurrentContext, PREFIX_BASE_URI, baseUri);
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, (ByteString)owner);
            if (transferPolicy == "transferable")
                Storage.Put(Storage.CurrentContext, PREFIX_TRANSFERABLE, 1);
        }

        [DisplayName("name")]
        [Safe]
        public static string Name() =>
            (string)Storage.Get(Storage.CurrentContext, PREFIX_NAME);

        [DisplayName("symbol")]
        [Safe]
        public static string Symbol() =>
            (string)Storage.Get(Storage.CurrentContext, PREFIX_SYMBOL);

        [DisplayName("decimals")]
        [Safe]
        public static byte Decimals() => 0;

        [DisplayName("totalSupply")]
        [Safe]
        public static BigInteger TotalSupply() => ReadInteger(PREFIX_TOTAL_SUPPLY);

        [DisplayName("balanceOf")]
        [Safe]
        public static BigInteger BalanceOf(UInt160 account)
        {
            ValidateAddress(account);
            ByteString raw = OwnerBalances().Get(account);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [DisplayName("ownerOf")]
        [Safe]
        public static UInt160 OwnerOf(ByteString tokenId)
        {
            ValidateTokenId(tokenId);
            ByteString raw = TokenOwners().Get(tokenId);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        [DisplayName("tokens")]
        [Safe]
        public static Iterator Tokens() =>
            Storage.Find(
                Storage.CurrentContext,
                new byte[] { PREFIX_TOKEN_OWNER },
                FindOptions.KeysOnly | FindOptions.RemovePrefix);

        [DisplayName("tokensOf")]
        [Safe]
        public static Iterator TokensOf(UInt160 owner)
        {
            ValidateAddress(owner);
            return Storage.Find(
                Storage.CurrentContext,
                Helper.Concat(new byte[] { PREFIX_OWNER_TOKEN }, owner),
                FindOptions.KeysOnly | FindOptions.RemovePrefix);
        }

        [DisplayName("properties")]
        [Safe]
        public static Map<string, object> Properties(ByteString tokenId)
        {
            UInt160 tokenOwner = OwnerOf(tokenId);
            ExecutionEngine.Assert(tokenOwner != UInt160.Zero, "token not found");
            string encodedId = StdLib.Base64Encode(tokenId);
            string tokenUri = BaseUri() + encodedId;
            Map<string, object> result = new Map<string, object>();
            result["name"] = Name() + " #" + encodedId;
            result["description"] = Name() + " collection token";
            result["image"] = tokenUri;
            result["tokenURI"] = tokenUri;
            result["royaltyBps"] = RoyaltyBps();
            return result;
        }

        [DisplayName("owner")]
        [Safe]
        public static UInt160 Owner() => ReadAddress(PREFIX_OWNER);

        [DisplayName("maxSupply")]
        [Safe]
        public static BigInteger MaxSupply() => ReadInteger(PREFIX_MAX_SUPPLY);

        [DisplayName("royaltyBps")]
        [Safe]
        public static BigInteger RoyaltyBps() => ReadInteger(PREFIX_ROYALTY_BPS);

        [DisplayName("baseUri")]
        [Safe]
        public static string BaseUri() =>
            (string)Storage.Get(Storage.CurrentContext, PREFIX_BASE_URI);

        [DisplayName("transferable")]
        [Safe]
        public static bool Transferable() =>
            Storage.Get(Storage.CurrentContext, PREFIX_TRANSFERABLE) != null;

        [DisplayName("paused")]
        [Safe]
        public static bool Paused() =>
            Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) != null;

        [DisplayName("royaltyInfo")]
        [Safe]
        public static object[] RoyaltyInfo(ByteString tokenId, BigInteger salePrice)
        {
            ExecutionEngine.Assert(OwnerOf(tokenId) != UInt160.Zero, "token not found");
            ExecutionEngine.Assert(salePrice >= 0, "invalid sale price");
            return new object[] { Owner(), salePrice * RoyaltyBps() / 10_000 };
        }

    }
}

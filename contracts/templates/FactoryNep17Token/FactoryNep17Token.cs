using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Templates
{
    public delegate void FactoryNep17TransferHandler(
        UInt160 from, UInt160 to, BigInteger amount);
    public delegate void FactoryNep17OwnerChangedHandler(
        UInt160 previousOwner, UInt160 newOwner);
    public delegate void FactoryNep17PausedHandler(bool paused);

    [DisplayName("FactoryNep17Token")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "Governed parameterized NEP-17 template for MiniAppFactory deployments.")]
    [SupportedStandards(NepStandard.Nep17)]
    [ContractPermission("*", "onNEP17Payment")]
    public class FactoryNep17Token : SmartContract
    {
        private static readonly byte[] PREFIX_NAME = new byte[] { 0x01 };
        private static readonly byte[] PREFIX_SYMBOL = new byte[] { 0x02 };
        private static readonly byte[] PREFIX_DECIMALS = new byte[] { 0x03 };
        private static readonly byte[] PREFIX_TOTAL_SUPPLY = new byte[] { 0x04 };
        private static readonly byte[] PREFIX_OWNER = new byte[] { 0x05 };
        private static readonly byte[] PREFIX_TREASURY = new byte[] { 0x06 };
        private static readonly byte[] PREFIX_MINTABLE = new byte[] { 0x07 };
        private static readonly byte[] PREFIX_PAUSED = new byte[] { 0x08 };
        private static readonly byte[] PREFIX_CALLBACK_LOCK = new byte[] { 0x09 };
        private const byte PREFIX_BALANCE = 0x20;

        private const int MAX_INIT_JSON_LENGTH = 4096;
        private const int MAX_NAME_LENGTH = 64;
        private const int MAX_SYMBOL_LENGTH = 12;

        [DisplayName("Transfer")]
        public static event FactoryNep17TransferHandler OnTransfer;
        [DisplayName("OwnerChanged")]
        public static event FactoryNep17OwnerChangedHandler OnOwnerChanged;
        [DisplayName("Paused")]
        public static event FactoryNep17PausedHandler OnPaused;

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

            string name = (string)init["name"];
            string symbol = (string)init["symbol"];
            BigInteger decimals = (BigInteger)init["decimals"];
            string supplyText = (string)init["initialSupplyUnits"];
            UInt160 owner = DecodeHash((string)init["ownerHashBase64"]);
            UInt160 treasury = DecodeHash((string)init["treasuryHashBase64"]);
            bool mintable = (bool)init["mintable"];
            BigInteger supply = StdLib.Atoi(supplyText, 10);

            ExecutionEngine.Assert(
                name != null && name.Length >= 3 && name.Length <= MAX_NAME_LENGTH,
                "invalid name");
            ExecutionEngine.Assert(IsValidSymbol(symbol), "invalid symbol");
            ExecutionEngine.Assert(decimals >= 0 && decimals <= 8, "invalid decimals");
            ExecutionEngine.Assert(supply > 0, "invalid initial supply");

            Storage.Put(Storage.CurrentContext, PREFIX_NAME, name);
            Storage.Put(Storage.CurrentContext, PREFIX_SYMBOL, symbol);
            Storage.Put(Storage.CurrentContext, PREFIX_DECIMALS, decimals);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY, supply);
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, (ByteString)owner);
            Storage.Put(Storage.CurrentContext, PREFIX_TREASURY, (ByteString)treasury);
            if (mintable) Storage.Put(Storage.CurrentContext, PREFIX_MINTABLE, 1);
            Balances().Put(treasury, supply);
            OnTransfer(UInt160.Zero, treasury, supply);
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
        public static byte Decimals() =>
            (byte)(BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_DECIMALS);

        [DisplayName("totalSupply")]
        [Safe]
        public static BigInteger TotalSupply() => ReadInteger(PREFIX_TOTAL_SUPPLY);

        [DisplayName("balanceOf")]
        [Safe]
        public static BigInteger BalanceOf(UInt160 account)
        {
            ValidateAddress(account);
            ByteString raw = Balances().Get(account);
            return raw == null ? 0 : (BigInteger)raw;
        }

        [DisplayName("owner")]
        [Safe]
        public static UInt160 Owner() => ReadAddress(PREFIX_OWNER);

        [DisplayName("treasury")]
        [Safe]
        public static UInt160 Treasury() => ReadAddress(PREFIX_TREASURY);

        [DisplayName("mintable")]
        [Safe]
        public static bool Mintable() =>
            Storage.Get(Storage.CurrentContext, PREFIX_MINTABLE) != null;

        [DisplayName("paused")]
        [Safe]
        public static bool Paused() =>
            Storage.Get(Storage.CurrentContext, PREFIX_PAUSED) != null;

        [DisplayName("transfer")]
        public static bool Transfer(UInt160 from, UInt160 to, BigInteger amount, object data)
        {
            ValidateNotPaused();
            ValidateAddress(from);
            ValidateAddress(to);
            ExecutionEngine.Assert(amount >= 0, "invalid amount");
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_CALLBACK_LOCK) == null,
                "reentrant transfer");
            if (!Runtime.CheckWitness(from)) return false;

            if (amount > 0 && from != to)
            {
                BigInteger fromBalance = BalanceOf(from);
                ExecutionEngine.Assert(fromBalance >= amount, "insufficient balance");
                PutBalance(from, fromBalance - amount);
                PutBalance(to, BalanceOf(to) + amount);
            }
            OnTransfer(from, to, amount);
            CallReceiver(from, to, amount, data);
            return true;
        }

        [DisplayName("mint")]
        public static void Mint(UInt160 to, BigInteger amount)
        {
            ValidateOwner();
            ValidateNotPaused();
            ValidateAddress(to);
            ExecutionEngine.Assert(Mintable(), "minting disabled");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            Storage.Put(
                Storage.CurrentContext,
                PREFIX_TOTAL_SUPPLY,
                TotalSupply() + amount);
            PutBalance(to, BalanceOf(to) + amount);
            OnTransfer(UInt160.Zero, to, amount);
            CallReceiver(UInt160.Zero, to, amount, null);
        }

        [DisplayName("burn")]
        public static void Burn(UInt160 from, BigInteger amount)
        {
            ValidateNotPaused();
            ValidateAddress(from);
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");
            ExecutionEngine.Assert(amount > 0, "invalid amount");
            BigInteger balance = BalanceOf(from);
            ExecutionEngine.Assert(balance >= amount, "insufficient balance");
            PutBalance(from, balance - amount);
            Storage.Put(
                Storage.CurrentContext,
                PREFIX_TOTAL_SUPPLY,
                TotalSupply() - amount);
            OnTransfer(from, UInt160.Zero, amount);
        }

        [DisplayName("setPaused")]
        public static void SetPaused(bool paused)
        {
            ValidateOwner();
            if (paused) Storage.Put(Storage.CurrentContext, PREFIX_PAUSED, 1);
            else Storage.Delete(Storage.CurrentContext, PREFIX_PAUSED);
            OnPaused(paused);
        }

        [DisplayName("setOwner")]
        public static void SetOwner(UInt160 newOwner)
        {
            ValidateOwner();
            ValidateAddress(newOwner);
            UInt160 previousOwner = Owner();
            Storage.Put(Storage.CurrentContext, PREFIX_OWNER, (ByteString)newOwner);
            OnOwnerChanged(previousOwner, newOwner);
        }

        private static StorageMap Balances() =>
            new StorageMap(Storage.CurrentContext, PREFIX_BALANCE);

        private static void PutBalance(UInt160 account, BigInteger balance)
        {
            if (balance == 0) Balances().Delete(account);
            else Balances().Put(account, balance);
        }

        private static void CallReceiver(
            UInt160 from, UInt160 to, BigInteger amount, object data)
        {
            if (to == UInt160.Zero || ContractManagement.GetContract(to) == null) return;
            Storage.Put(Storage.CurrentContext, PREFIX_CALLBACK_LOCK, 1);
            Contract.Call(to, "onNEP17Payment", CallFlags.All, from, amount, data);
            Storage.Delete(Storage.CurrentContext, PREFIX_CALLBACK_LOCK);
        }

        private static void ValidateOwner() =>
            ExecutionEngine.Assert(Runtime.CheckWitness(Owner()), "unauthorized");

        private static void ValidateNotPaused() =>
            ExecutionEngine.Assert(!Paused(), "paused");

        private static void ValidateAddress(UInt160 account) =>
            ExecutionEngine.Assert(
                account != null && account.IsValid && account != UInt160.Zero,
                "invalid address");

        private static UInt160 DecodeHash(string encoded)
        {
            ExecutionEngine.Assert(encoded != null && encoded.Length > 0, "invalid address");
            ByteString raw = StdLib.Base64Decode(encoded);
            ExecutionEngine.Assert(raw != null && raw.Length == 20, "invalid address");
            UInt160 account = (UInt160)raw;
            ValidateAddress(account);
            return account;
        }

        private static UInt160 ReadAddress(byte[] key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            return raw == null ? UInt160.Zero : (UInt160)raw;
        }

        private static BigInteger ReadInteger(byte[] key)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, key);
            return raw == null ? 0 : (BigInteger)raw;
        }

        private static bool IsValidSymbol(string symbol)
        {
            if (symbol == null || symbol.Length < 2 || symbol.Length > MAX_SYMBOL_LENGTH)
                return false;
            for (int i = 0; i < symbol.Length; i++)
            {
                char value = symbol[i];
                if (!(value >= 'A' && value <= 'Z' || value >= '0' && value <= '9'))
                    return false;
            }
            return symbol[0] >= 'A' && symbol[0] <= 'Z';
        }
    }
}

using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts.Templates
{
    public partial class FactoryNep11Collection
    {
        [DisplayName("mint")]
        public static void Mint(UInt160 to, ByteString tokenId)
        {
            ValidateOwner();
            ValidateNotPaused();
            ValidateAddress(to);
            ValidateTokenId(tokenId);
            ExecutionEngine.Assert(TotalSupply() < MaxSupply(), "max supply reached");
            ExecutionEngine.Assert(OwnerOf(tokenId) == UInt160.Zero, "token exists");

            TokenOwners().Put(tokenId, to);
            PutOwnerBalance(to, BalanceOf(to) + 1);
            OwnerTokens().Put(Helper.Concat(to, tokenId), 1);
            Storage.Put(
                Storage.CurrentContext,
                PREFIX_TOTAL_SUPPLY,
                TotalSupply() + 1);
            OnTransfer(UInt160.Zero, to, 1, tokenId);
            CallReceiver(UInt160.Zero, to, tokenId, null);
        }

        [DisplayName("transfer")]
        public static bool Transfer(UInt160 to, ByteString tokenId, object data)
        {
            ValidateNotPaused();
            ValidateAddress(to);
            ValidateTokenId(tokenId);
            ExecutionEngine.Assert(
                Storage.Get(Storage.CurrentContext, PREFIX_CALLBACK_LOCK) == null,
                "reentrant transfer");
            UInt160 from = OwnerOf(tokenId);
            ExecutionEngine.Assert(from != UInt160.Zero, "token not found");
            if (!Runtime.CheckWitness(from)) return false;
            ExecutionEngine.Assert(Transferable() || from == to, "soulbound");

            if (from != to)
            {
                TokenOwners().Put(tokenId, to);
                OwnerTokens().Delete(Helper.Concat(from, tokenId));
                OwnerTokens().Put(Helper.Concat(to, tokenId), 1);
                PutOwnerBalance(from, BalanceOf(from) - 1);
                PutOwnerBalance(to, BalanceOf(to) + 1);
            }
            OnTransfer(from, to, 1, tokenId);
            CallReceiver(from, to, tokenId, data);
            return true;
        }

        [DisplayName("burn")]
        public static void Burn(ByteString tokenId)
        {
            ValidateNotPaused();
            UInt160 from = OwnerOf(tokenId);
            ExecutionEngine.Assert(from != UInt160.Zero, "token not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");
            TokenOwners().Delete(tokenId);
            OwnerTokens().Delete(Helper.Concat(from, tokenId));
            PutOwnerBalance(from, BalanceOf(from) - 1);
            Storage.Put(
                Storage.CurrentContext,
                PREFIX_TOTAL_SUPPLY,
                TotalSupply() - 1);
            OnTransfer(from, UInt160.Zero, 1, tokenId);
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

        private static StorageMap TokenOwners() =>
            new StorageMap(Storage.CurrentContext, PREFIX_TOKEN_OWNER);

        private static StorageMap OwnerBalances() =>
            new StorageMap(Storage.CurrentContext, PREFIX_OWNER_BALANCE);

        private static StorageMap OwnerTokens() =>
            new StorageMap(Storage.CurrentContext, PREFIX_OWNER_TOKEN);

        private static void PutOwnerBalance(UInt160 owner, BigInteger balance)
        {
            if (balance == 0) OwnerBalances().Delete(owner);
            else OwnerBalances().Put(owner, balance);
        }

        private static void CallReceiver(
            UInt160 from, UInt160 to, ByteString tokenId, object data)
        {
            if (to == UInt160.Zero || ContractManagement.GetContract(to) == null) return;
            Storage.Put(Storage.CurrentContext, PREFIX_CALLBACK_LOCK, 1);
            Contract.Call(to, "onNEP11Payment", CallFlags.All, from, 1, tokenId, data);
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

        private static void ValidateTokenId(ByteString tokenId) =>
            ExecutionEngine.Assert(
                tokenId != null && tokenId.Length > 0 && tokenId.Length <= MAX_TOKEN_ID_LENGTH,
                "invalid token id");

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

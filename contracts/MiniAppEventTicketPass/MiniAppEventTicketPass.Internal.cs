using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppEventTicketPass
    {
        #region Internal Helpers

        private static void StoreEvent(BigInteger eventId, EventData data)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_EVENTS, (ByteString)eventId.ToByteArray()),
                StdLib.Serialize(data));
        }

        private static void StoreTicket(ByteString tokenId, TicketData data)
        {
            Storage.Put(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TICKETS, tokenId),
                StdLib.Serialize(data));
        }

        private static void AddCreatorEvent(UInt160 creator, BigInteger eventId)
        {
            byte[] countKey = Helper.Concat(PREFIX_CREATOR_EVENT_COUNT, creator);
            BigInteger count = (BigInteger)Storage.Get(Storage.CurrentContext, countKey);
            Storage.Put(Storage.CurrentContext, countKey, count + 1);

            byte[] key = Helper.Concat(
                Helper.Concat(PREFIX_CREATOR_EVENTS, creator),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, eventId);
        }

        private static BigInteger GetCreatorEventCountInternal(UInt160 creator)
        {
            byte[] key = Helper.Concat(PREFIX_CREATOR_EVENT_COUNT, creator);
            return (BigInteger)Storage.Get(Storage.CurrentContext, key);
        }

        private static void ValidateEventText(string name, string venue, string notes)
        {
            ExecutionEngine.Assert(name != null && name.Length > 0, "event name required");
            ExecutionEngine.Assert(name.Length <= MAX_EVENT_NAME_LENGTH, "event name too long");
            if (venue != null)
            {
                ExecutionEngine.Assert(venue.Length <= MAX_VENUE_LENGTH, "venue too long");
            }
            if (notes != null)
            {
                ExecutionEngine.Assert(notes.Length <= MAX_NOTE_LENGTH, "notes too long");
            }
        }

        private static void ValidateTicketText(string seat, string memo)
        {
            if (seat != null)
            {
                ExecutionEngine.Assert(seat.Length <= MAX_SEAT_LENGTH, "seat too long");
            }
            if (memo != null)
            {
                ExecutionEngine.Assert(memo.Length <= MAX_MEMO_LENGTH, "memo too long");
            }
        }

        private static ByteString BuildTokenId(BigInteger eventId, BigInteger serial)
        {
            return (ByteString)(eventId.ToString() + "-" + serial.ToString());
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
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(Helper.Concat(PREFIX_OWNER_TOKEN, owner), tokenId),
                1);
        }

        private static void RemoveTokenFromOwner(UInt160 owner, ByteString tokenId)
        {
            Storage.Delete(Storage.CurrentContext,
                Helper.Concat(Helper.Concat(PREFIX_OWNER_TOKEN, owner), tokenId));
        }

        private static void RegisterToken(ByteString tokenId)
        {
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_TOKENS, tokenId), 1);
        }

        private static void IncreaseTotalSupply(BigInteger delta)
        {
            BigInteger current = TotalTickets();
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

        private static void TransferToken(UInt160 from, UInt160 to, ByteString tokenId)
        {
            PutTokenOwner(tokenId, to);
            RemoveTokenFromOwner(from, tokenId);
            AddTokenToOwner(to, tokenId);
            UpdateBalance(from, -1);
            UpdateBalance(to, 1);

            OnTransfer(from, to, tokenId);
        }

        #endregion
    }
}

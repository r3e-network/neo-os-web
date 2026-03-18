using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppEventTicketPass
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
        public static BigInteger TotalSupply() => TotalTickets();

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
            return Storage.Find(Storage.CurrentContext, PREFIX_TOKENS, FindOptions.KeysOnly | FindOptions.RemovePrefix);
        }

        [DisplayName("tokensOf")]
        [Safe]
        public static Iterator TokensOf(UInt160 owner)
        {
            ValidateAddress(owner);
            return Storage.Find(
                Storage.CurrentContext,
                Helper.Concat(PREFIX_OWNER_TOKEN, owner),
                FindOptions.KeysOnly | FindOptions.RemovePrefix);
        }

        [DisplayName("properties")]
        [Safe]
        public static Map<string, object> Properties(ByteString tokenId)
        {
            TicketData ticket = GetTicket(tokenId);
            Map<string, object> props = new Map<string, object>();
            if (ticket.EventId <= 0) return props;

            EventData data = GetEvent(ticket.EventId);
            props["tokenId"] = tokenId;
            props["eventId"] = ticket.EventId;
            props["eventName"] = data.Name;
            props["venue"] = data.Venue;
            props["startTime"] = data.StartTime;
            props["endTime"] = data.EndTime;
            props["seat"] = ticket.Seat;
            props["memo"] = ticket.Memo;
            props["used"] = ticket.Used;
            props["issuedTime"] = ticket.IssuedTime;
            props["usedTime"] = ticket.UsedTime;
            return props;
        }

        #endregion

        #region App Queries

        [Safe]
        public static Map<string, object> GetEventDetails(BigInteger eventId)
        {
            EventData data = GetEvent(eventId);
            Map<string, object> details = new Map<string, object>();
            if (data.Creator == UInt160.Zero) return details;

            details["id"] = eventId;
            details["creator"] = data.Creator;
            details["name"] = data.Name;
            details["venue"] = data.Venue;
            details["startTime"] = data.StartTime;
            details["endTime"] = data.EndTime;
            details["maxSupply"] = data.MaxSupply;
            details["minted"] = data.Minted;
            details["notes"] = data.Notes;
            details["active"] = data.Active;
            details["createdTime"] = data.CreatedTime;
            details["status"] = data.Active ? "active" : "inactive";
            return details;
        }

        [Safe]
        public static Map<string, object> GetTicketDetails(ByteString tokenId)
        {
            TicketData ticket = GetTicket(tokenId);
            Map<string, object> details = new Map<string, object>();
            if (ticket.EventId <= 0) return details;

            EventData data = GetEvent(ticket.EventId);
            details["tokenId"] = tokenId;
            details["eventId"] = ticket.EventId;
            details["owner"] = ticket.Owner;
            details["eventName"] = data.Name;
            details["venue"] = data.Venue;
            details["startTime"] = data.StartTime;
            details["endTime"] = data.EndTime;
            details["seat"] = ticket.Seat;
            details["memo"] = ticket.Memo;
            details["issuedTime"] = ticket.IssuedTime;
            details["used"] = ticket.Used;
            details["usedTime"] = ticket.UsedTime;
            details["active"] = data.Active;
            return details;
        }

        [Safe]
        public static BigInteger GetCreatorEventCount(UInt160 creator)
        {
            return GetCreatorEventCountInternal(creator);
        }

        [Safe]
        public static BigInteger[] GetCreatorEvents(UInt160 creator, BigInteger offset, BigInteger limit)
        {
            BigInteger count = GetCreatorEventCountInternal(creator);
            if (offset >= count) return new BigInteger[0];

            BigInteger end = offset + limit;
            if (end > count) end = count;
            BigInteger resultCount = end - offset;

            BigInteger[] result = new BigInteger[(int)resultCount];
            for (BigInteger i = 0; i < resultCount; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_CREATOR_EVENTS, creator),
                    (ByteString)(offset + i).ToByteArray());
                result[(int)i] = (BigInteger)Storage.Get(Storage.CurrentContext, key);
            }
            return result;
        }

        [Safe]
        public static Map<string, object> GetPlatformStats()
        {
            Map<string, object> stats = new Map<string, object>();
            stats["totalEvents"] = TotalEvents();
            stats["totalTickets"] = TotalTickets();
            stats["maxSupply"] = MAX_SUPPLY;
            stats["maxEventNameLength"] = MAX_EVENT_NAME_LENGTH;
            stats["maxVenueLength"] = MAX_VENUE_LENGTH;
            return stats;
        }

        #endregion
    }
}

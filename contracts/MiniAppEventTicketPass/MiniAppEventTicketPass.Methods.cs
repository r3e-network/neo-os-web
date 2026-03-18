using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppEventTicketPass
    {
        #region User Methods

        /// <summary>
        /// Creates a new event.
        /// </summary>
        public static BigInteger CreateEvent(
            UInt160 creator,
            string name,
            string venue,
            BigInteger startTime,
            BigInteger endTime,
            BigInteger maxSupply,
            string notes)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ValidateEventText(name, venue, notes);

            ExecutionEngine.Assert(startTime > 0, "start time required");
            ExecutionEngine.Assert(endTime >= startTime, "end time invalid");
            ExecutionEngine.Assert(maxSupply > 0 && maxSupply <= MAX_SUPPLY, "invalid max supply");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            BigInteger eventId = TotalEvents() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_EVENT_ID, eventId);

            EventData data = new EventData
            {
                Creator = creator,
                Name = name,
                Venue = venue,
                StartTime = startTime,
                EndTime = endTime,
                MaxSupply = maxSupply,
                Minted = 0,
                Notes = notes,
                Active = true,
                CreatedTime = Runtime.Time
            };

            StoreEvent(eventId, data);
            AddCreatorEvent(creator, eventId);

            OnEventCreated(eventId, creator, name);
            return eventId;
        }

        /// <summary>
        /// Updates event metadata (creator-only).
        /// </summary>
        public static void UpdateEvent(
            UInt160 creator,
            BigInteger eventId,
            string name,
            string venue,
            BigInteger startTime,
            BigInteger endTime,
            BigInteger maxSupply,
            string notes)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ValidateEventText(name, venue, notes);

            EventData data = GetEvent(eventId);
            ExecutionEngine.Assert(data.Creator != UInt160.Zero, "event not found");
            ExecutionEngine.Assert(data.Creator == creator, "not creator");

            ExecutionEngine.Assert(startTime > 0, "start time required");
            ExecutionEngine.Assert(endTime >= startTime, "end time invalid");
            ExecutionEngine.Assert(maxSupply >= data.Minted && maxSupply <= MAX_SUPPLY, "invalid max supply");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            data.Name = name;
            data.Venue = venue;
            data.StartTime = startTime;
            data.EndTime = endTime;
            data.MaxSupply = maxSupply;
            data.Notes = notes;

            StoreEvent(eventId, data);
            OnEventUpdated(eventId);
        }

        /// <summary>
        /// Toggles event active state (creator-only).
        /// </summary>
        public static void SetEventActive(UInt160 creator, BigInteger eventId, bool active)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);

            EventData data = GetEvent(eventId);
            ExecutionEngine.Assert(data.Creator != UInt160.Zero, "event not found");
            ExecutionEngine.Assert(data.Creator == creator, "not creator");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            data.Active = active;
            StoreEvent(eventId, data);
            OnEventUpdated(eventId);
        }

        /// <summary>
        /// Issues a ticket for an event (creator-only).
        /// </summary>
        public static ByteString IssueTicket(
            UInt160 creator,
            UInt160 recipient,
            BigInteger eventId,
            string seat,
            string memo)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);
            ValidateAddress(recipient);
            ValidateTicketText(seat, memo);

            EventData data = GetEvent(eventId);
            ExecutionEngine.Assert(data.Creator != UInt160.Zero, "event not found");
            ExecutionEngine.Assert(data.Active, "event inactive");
            ExecutionEngine.Assert(data.Creator == creator, "not creator");
            ExecutionEngine.Assert(data.Minted < data.MaxSupply, "sold out");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            BigInteger serial = data.Minted + 1;
            ByteString tokenId = BuildTokenId(eventId, serial);
            MintToken(recipient, tokenId);

            TicketData ticket = new TicketData
            {
                EventId = eventId,
                Owner = recipient,
                IssuedTime = Runtime.Time,
                Used = false,
                UsedTime = 0,
                Seat = seat,
                Memo = memo
            };
            StoreTicket(tokenId, ticket);

            data.Minted = serial;
            StoreEvent(eventId, data);

            OnTicketIssued(tokenId, eventId, recipient);
            return tokenId;
        }

        /// <summary>
        /// Marks a ticket as used (creator or gateway).
        /// </summary>
        public static void CheckIn(UInt160 creator, ByteString tokenId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(creator);

            TicketData ticket = GetTicket(tokenId);
            ExecutionEngine.Assert(ticket.EventId > 0, "ticket not found");

            EventData data = GetEvent(ticket.EventId);
            ExecutionEngine.Assert(data.Creator != UInt160.Zero, "event not found");
            ExecutionEngine.Assert(data.Creator == creator, "not creator");
            ExecutionEngine.Assert(data.Active, "event inactive");
            ExecutionEngine.Assert(!ticket.Used, "ticket already used");

            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");

            ticket.Used = true;
            ticket.UsedTime = Runtime.Time;
            StoreTicket(tokenId, ticket);

            OnTicketCheckedIn(tokenId, ticket.EventId, creator);
        }

        /// <summary>
        /// NEP-11 Transfer (non-divisible).
        /// </summary>
        public static bool Transfer(UInt160 from, UInt160 to, ByteString tokenId, object data)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(from);
            ValidateAddress(to);

            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");
            ExecutionEngine.Assert(GetTokenOwner(tokenId) == from, "not owner");

            TicketData ticket = GetTicket(tokenId);
            ExecutionEngine.Assert(ticket.EventId > 0, "ticket not found");
            ExecutionEngine.Assert(!ticket.Used, "ticket already used");

            if (from == to) return true;

            TransferToken(from, to, tokenId);

            ticket.Owner = to;
            StoreTicket(tokenId, ticket);

            if (ContractManagement.GetContract(to) != null)
            {
                Contract.Call(to, "onNEP11Payment", CallFlags.All, from, tokenId, data);
            }
            return true;
        }

        #endregion
    }
}

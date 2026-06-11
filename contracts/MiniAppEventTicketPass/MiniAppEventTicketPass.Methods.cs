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

            // Cap events per creator. AddCreatorEvent already tracks the running
            // count via PREFIX_CREATOR_EVENT_COUNT, so this check is O(1).
            ExecutionEngine.Assert(
                GetCreatorEventCountInternal(creator) < MAX_EVENTS_PER_CREATOR,
                "creator event quota exhausted");

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
        /// NEP-11 Transfer using the standard non-divisible signature
        /// (to, tokenId, data) required by the NEP-11 supportedStandards
        /// declaration (tri-repo review MP-D-02). The current owner is resolved
        /// from the token itself and must witness the transaction.
        /// </summary>
        public static bool Transfer(UInt160 to, ByteString tokenId, object data)
        {
            ValidateNotGloballyPaused(APP_ID);
            ValidateAddress(to);

            UInt160 from = GetTokenOwner(tokenId);
            ExecutionEngine.Assert(from != UInt160.Zero, "ticket not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(from), "unauthorized");

            TicketData ticket = GetTicket(tokenId);
            ExecutionEngine.Assert(ticket.EventId > 0, "ticket not found");
            ExecutionEngine.Assert(!ticket.Used, "ticket already used");

            if (from != to)
            {
                TransferToken(from, to, tokenId);

                ticket.Owner = to;
                StoreTicket(tokenId, ticket);
            }
            else
            {
                // NEP-11: a self-transfer is still a successful transfer — emit
                // the standard event so indexers observe it (no state change).
                OnTransfer(from, to, 1, tokenId);
            }

            if (ContractManagement.GetContract(to) != null)
            {
                // Audit fix NEW-H-4: CallFlags.All let the recipient write back
                // to MiniAppEventTicketPass storage and reuse the sender's
                // witness for other tickets. AllowCall lets the recipient
                // perform downstream business logic (e.g. logging, escrow
                // record-keeping), AllowNotify lets it emit events. It can
                // no longer write to platform storage under our witness or
                // ride the seller's signature to drain other tickets.
                // NEP-11 onNEP11Payment shape: (from, amount, tokenId, data).
                Contract.Call(to, "onNEP11Payment", CallFlags.AllowCall | CallFlags.AllowNotify, from, 1, tokenId, data);
            }
            return true;
        }

        #endregion
    }
}

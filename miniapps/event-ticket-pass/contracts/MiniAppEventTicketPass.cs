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
    /// EventTicketPass MiniApp - NEP-11 compliant ticketing with QR check-in.
    ///
    /// KEY FEATURES:
    /// - Create events with configurable parameters
    /// - Mint NEP-11 tickets as NFTs
    /// - QR code generation for check-in
    /// - Ticket transfer and resale
    /// - Check-in verification by operators
    /// - Event management tools
    ///
    /// SECURITY:
    /// - Mint limit enforcement
    /// - Check-in authorization
    /// - Event creator permissions
    /// - Transfer validation
    ///
    /// PERMISSIONS:
    /// - GAS token transfers for ticket sales
    /// - NEP-11 token operations
    /// </summary>
    [DisplayName("MiniAppEventTicketPass")]
    [SupportedStandards("NEP-11")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "EventTicketPass issues NEP-11 tickets with QR check-in support for event management.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]
    public partial class MiniAppEventTicketPass : MiniAppBase
    {
        #region App Constants
        /// <summary>Unique application identifier for the EventTicketPass miniapp.</summary>
        /// <summary>Unique application identifier for the event-ticket-pass miniapp.</summary>
        private const string APP_ID = "miniapp-event-ticket-pass";
        
        /// <summary>Token symbol for tickets.</summary>
        private const string TOKEN_SYMBOL = "TICKET";
        
        /// <summary>Token decimals (0 for NFT).</summary>
        private const byte TOKEN_DECIMALS = 0;
        
        /// <summary>Maximum event name length.</summary>
        private const int MAX_EVENT_NAME_LENGTH = 60;
        
        /// <summary>Maximum venue length.</summary>
        private const int MAX_VENUE_LENGTH = 60;
        
        /// <summary>Maximum notes length.</summary>
        private const int MAX_NOTE_LENGTH = 240;
        
        /// <summary>Maximum seat identifier length.</summary>
        private const int MAX_SEAT_LENGTH = 24;
        
        /// <summary>Maximum memo length.</summary>
        private const int MAX_MEMO_LENGTH = 160;
        
        /// <summary>Maximum ticket supply per event.</summary>
        private const int MAX_SUPPLY = 100000;
        #endregion

        #region Storage Prefixes
        /// <summary>Prefix 0x20: Current event ID counter.</summary>
        /// <summary>Storage prefix for event id.</summary>
        private static readonly byte[] PREFIX_EVENT_ID = new byte[] { 0x20 };
        
        /// <summary>Prefix 0x21: Event data storage.</summary>
        /// <summary>Storage prefix for events.</summary>
        private static readonly byte[] PREFIX_EVENTS = new byte[] { 0x21 };
        
        /// <summary>Prefix 0x22: Creator event list.</summary>
        /// <summary>Storage prefix for creator events.</summary>
        private static readonly byte[] PREFIX_CREATOR_EVENTS = new byte[] { 0x22 };
        
        /// <summary>Prefix 0x23: Creator event count.</summary>
        /// <summary>Storage prefix for creator event count.</summary>
        private static readonly byte[] PREFIX_CREATOR_EVENT_COUNT = new byte[] { 0x23 };
        
        /// <summary>Prefix 0x24: Ticket data storage.</summary>
        /// <summary>Storage prefix for tickets.</summary>
        private static readonly byte[] PREFIX_TICKETS = new byte[] { 0x24 };

        // NEP-11 storage prefixes
        /// <summary>Prefix 0x30: Total token supply.</summary>
        /// <summary>Storage prefix for total supply.</summary>
        private static readonly byte[] PREFIX_TOTAL_SUPPLY = new byte[] { 0x30 };
        
        /// <summary>Prefix 0x31: Token to owner mapping.</summary>
        /// <summary>Storage prefix for token owner.</summary>
        private static readonly byte[] PREFIX_TOKEN_OWNER = new byte[] { 0x31 };
        
        /// <summary>Prefix 0x32: Owner balance.</summary>
        /// <summary>Storage prefix for owner balance.</summary>
        private static readonly byte[] PREFIX_OWNER_BALANCE = new byte[] { 0x32 };
        
        /// <summary>Prefix 0x33: Owner token list.</summary>
        /// <summary>Storage prefix for owner token.</summary>
        private static readonly byte[] PREFIX_OWNER_TOKEN = new byte[] { 0x33 };
        
        /// <summary>Prefix 0x34: Token metadata.</summary>
        /// <summary>Storage prefix for tokens.</summary>
        private static readonly byte[] PREFIX_TOKENS = new byte[] { 0x34 };
        #endregion

        #region Data Structures
        /// <summary>
        /// Event data structure.
        /// FIELDS:
        /// - Creator: Event creator address
        /// - Name: Event name
        /// - Venue: Event location
        /// - StartTime: Event start timestamp
        /// - EndTime: Event end timestamp
        /// - MaxSupply: Maximum tickets available
        /// - Minted: Tickets minted so far
        /// - Notes: Additional notes
        /// - Active: Whether event is active
        /// - CreatedTime: Creation timestamp
        /// </summary>
        public struct EventData
        {
            public UInt160 Creator;
            public string Name;
            public string Venue;
            public BigInteger StartTime;
            public BigInteger EndTime;
            public BigInteger MaxSupply;
            public BigInteger Minted;
            public string Notes;
            public bool Active;
            public BigInteger CreatedTime;
        }

        /// <summary>
        /// Ticket data structure.
        /// FIELDS:
        /// - EventId: Associated event
        /// - Owner: Current ticket owner
        /// - IssuedTime: Mint timestamp
        /// - Used: Whether checked in
        /// - UsedTime: Check-in timestamp
        /// - Seat: Seat assignment
        /// - Memo: Additional memo
        /// </summary>
        public struct TicketData
        {
            public BigInteger EventId;
            public UInt160 Owner;
            public BigInteger IssuedTime;
            public bool Used;
            public BigInteger UsedTime;
            public string Seat;
            public string Memo;
        }
        #endregion

        #region Event Delegates
        /// <summary>Event emitted when event is created.</summary>
        /// <param name="eventId">New event identifier.</param>
        /// <param name="creator">Creator address.</param>
        /// <param name="name">Event name.</param>
        /// <summary>Event emitted when event created.</summary>
    public delegate void EventCreatedHandler(BigInteger eventId, UInt160 creator, string name);
        
        /// <summary>Event emitted when event is updated.</summary>
        /// <param name="eventId">Event identifier.</param>
        /// <summary>Event emitted when event updated.</summary>
    public delegate void EventUpdatedHandler(BigInteger eventId);
        
        /// <summary>Event emitted when ticket is issued.</summary>
        /// <param name="tokenId">Ticket token ID.</param>
        /// <param name="eventId">Event identifier.</param>
        /// <param name="owner">Ticket owner.</param>
        /// <summary>Event emitted when ticket issued.</summary>
    public delegate void TicketIssuedHandler(ByteString tokenId, BigInteger eventId, UInt160 owner);
        
        /// <summary>Event emitted when ticket is checked in.</summary>
        /// <param name="tokenId">Ticket token ID.</param>
        /// <param name="eventId">Event identifier.</param>
        /// <param name="operatorAddress">Operator who performed check-in.</param>
        /// <summary>Event emitted when ticket checked in.</summary>
    public delegate void TicketCheckedInHandler(ByteString tokenId, BigInteger eventId, UInt160 operatorAddress);
        
        /// <summary>Event emitted when ticket is transferred.</summary>
        /// <param name="from">Previous owner.</param>
        /// <param name="to">New owner.</param>
        /// <param name="tokenId">Ticket token ID.</param>
        /// <summary>Event emitted when transfer.</summary>
    public delegate void TransferHandler(UInt160 from, UInt160 to, ByteString tokenId);
        #endregion

        #region Events
        [DisplayName("EventCreated")]
        public static event EventCreatedHandler OnEventCreated;

        [DisplayName("EventUpdated")]
        public static event EventUpdatedHandler OnEventUpdated;

        [DisplayName("TicketIssued")]
        public static event TicketIssuedHandler OnTicketIssued;

        [DisplayName("TicketCheckedIn")]
        public static event TicketCheckedInHandler OnTicketCheckedIn;

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
            Storage.Put(Storage.CurrentContext, PREFIX_EVENT_ID, 0);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY, 0);
        }
        #endregion

        #region Core Read Methods
        /// <summary>
        /// Gets total events created.
        /// </summary>
        /// <returns>Total event count.</returns>
        [Safe]
        public static BigInteger TotalEvents() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_EVENT_ID);

        /// <summary>
        /// Gets total tickets minted.
        /// </summary>
        /// <returns>Total ticket count.</returns>
        [Safe]
        public static BigInteger TotalTickets() =>
            (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_SUPPLY);

        /// <summary>
        /// Gets event data by ID.
        /// </summary>
        /// <param name="eventId">Event identifier.</param>
        /// <returns>Event data struct.</returns>
        [Safe]
        public static EventData GetEvent(BigInteger eventId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_EVENTS, (ByteString)eventId.ToByteArray()));
            if (data == null) return new EventData();
            return (EventData)StdLib.Deserialize(data);
        }

        /// <summary>
        /// Gets ticket data by token ID.
        /// </summary>
        /// <param name="tokenId">Ticket token ID.</param>
        /// <returns>Ticket data struct.</returns>
        [Safe]
        public static TicketData GetTicket(ByteString tokenId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TICKETS, tokenId));
            if (data == null) return new TicketData();
            return (TicketData)StdLib.Deserialize(data);
        }
        #endregion
    }
}

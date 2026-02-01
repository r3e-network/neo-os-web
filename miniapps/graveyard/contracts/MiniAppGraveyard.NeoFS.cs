using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Graveyard NeoFS Extension - Decentralized storage for encrypted memories
    /// 
    /// This extension adds NeoFS support to the Graveyard miniapp, enabling:
    /// - Storage of large encrypted memories (photos, videos, documents)
    /// - Content-addressed integrity verification
    /// - Cheaper storage costs for memorial content
    /// 
    /// MEMORY STORAGE MODES:
    /// 1. HASH-ONLY MODE (Original): Store only content hash (data stored elsewhere)
    ///    - ContentHash: SHA256 hash of the encrypted content
    ///    - No on-chain data storage
    ///    - User manages content storage independently
    /// 
    /// 2. NEOFS MODE (Enhanced): Store NeoFS reference with content hash
    ///    - ContentHash: SHA256 hash for verification
    ///    - NeoFSContainerId: Container in NeoFS network
    ///    - NeoFSObjectId: Object identifier in container
    ///    - Content stored permanently in NeoFS
    ///    - 99% cheaper than on-chain, unlimited size
    /// 
    /// EPITAPH STORAGE:
    /// - Small text (< 500 chars): Stored on-chain
    /// - Large content: Store in NeoFS, reference on-chain
    /// 
    /// MEMORIAL ASSETS:
    /// - Photos, videos, audio: NeoFS storage
    /// - Metadata: On-chain storage
    /// </summary>
    public partial class MiniAppGraveyard
    {
        #region NeoFS Configuration
        
        // Maximum size for on-chain epitaphs
        private const int MAX_ONCHAIN_EPITAPH = 500;
        
        // Threshold for NeoFS storage
        private const int NEFOS_THRESHOLD = 1000;  // Content > 1KB uses NeoFS
        
        // Memory types that benefit from NeoFS
        private const BigInteger MEMORY_TYPE_PHOTO = 1;
        private const BigInteger MEMORY_TYPE_VIDEO = 2;
        private const BigInteger MEMORY_TYPE_AUDIO = 3;
        private const BigInteger MEMORY_TYPE_DOCUMENT = 4;
        private const BigInteger MEMORY_TYPE_SECRET = 5;
        
        // Additional storage prefixes (0x30+ range, non-conflicting)
        /// <summary>Storage prefix for memory nefos container.</summary>
        private static readonly byte[] PREFIX_MEMORY_NEFOS_CONTAINER = new byte[] { 0x30 };
        /// <summary>Storage prefix for memory nefos object.</summary>
        private static readonly byte[] PREFIX_MEMORY_NEFOS_OBJECT = new byte[] { 0x31 };
        /// <summary>Storage prefix for memory nefos size.</summary>
        private static readonly byte[] PREFIX_MEMORY_NEFOS_SIZE = new byte[] { 0x32 };
        /// <summary>Storage prefix for memory nefos encrypted.</summary>
        private static readonly byte[] PREFIX_MEMORY_NEFOS_ENCRYPTED = new byte[] { 0x33 };
        /// <summary>Storage prefix for epitaph nefos ref.</summary>
        private static readonly byte[] PREFIX_EPITAPH_NEFOS_REF = new byte[] { 0x34 };
        /// <summary>Storage prefix for memorial media ref.</summary>
        private static readonly byte[] PREFIX_MEMORIAL_MEDIA_REF = new byte[] { 0x35 };
        
        #endregion

        #region Enhanced Data Structures
        
        /// <summary>
        /// NeoFS-enhanced memory information.
        /// Extends the base Memory struct with NeoFS references.
        /// </summary>
        public new struct Memory
        {
            public UInt160 Owner;
            public string ContentHash;           // SHA256 hash (hex string)
            public BigInteger MemoryType;
            public BigInteger BuriedTime;
            public BigInteger ForgottenTime;
            public string Epitaph;
            public bool Forgotten;
            
            // NeoFS mode fields
            public string NeoFSContainerId;      // null if hash-only mode
            public string NeoFSObjectId;         // null if hash-only mode
            public BigInteger ContentSize;       // File size in bytes
            public bool IsNeoFS;                 // True if stored in NeoFS
        }
        
        /// <summary>
        /// Memorial media reference for NeoFS-stored assets.
        /// </summary>
        public struct MemorialMedia
        {
            public BigInteger MemorialId;
            public string PhotoContainerId;
            public string PhotoObjectId;
            public string AudioContainerId;      // Optional: voice message
            public string AudioObjectId;
            public ByteString PhotoHash;
            public ByteString AudioHash;
            public BigInteger UploadedAt;
        }
        
        #endregion

        #region NeoFS Events
        
        /// <summary>Event emitted when memory stored in neo f s.</summary>
    public delegate void MemoryStoredInNeoFSHandler(BigInteger memoryId, string containerId, string objectId);
        /// <summary>Event emitted when memorial media added.</summary>
    public delegate void MemorialMediaAddedHandler(BigInteger memorialId, string mediaType);
        
        [DisplayName("MemoryStoredInNeoFS")]
        public static event MemoryStoredInNeoFSHandler OnMemoryStoredInNeoFS;
        
        [DisplayName("MemorialMediaAdded")]
        public static event MemorialMediaAddedHandler OnMemorialMediaAdded;
        
        #endregion

        #region Enhanced Read Methods
        
        /// <summary>
        /// Get enhanced memory info with NeoFS support.
        /// </summary>
        [Safe]
        public static new Memory GetMemory(BigInteger memoryId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMORIES, (ByteString)memoryId.ToByteArray()));
            if (data == null) return new Memory();
            
            // Deserialize base memory
            Memory memory = (Memory)StdLib.Deserialize(data);
            
            // Check for NeoFS data
            byte[] containerKey = Helper.Concat(PREFIX_MEMORY_NEFOS_CONTAINER, (ByteString)memoryId.ToByteArray());
            ByteString containerData = Storage.Get(Storage.CurrentContext, containerKey);
            
            if (containerData != null)
            {
                memory.NeoFSContainerId = containerData.ToString();
                memory.NeoFSObjectId = GetMemoryNeoFSObjectId(memoryId);
                memory.ContentSize = GetMemoryContentSize(memoryId);
                memory.IsNeoFS = true;
            }
            else
            {
                memory.IsNeoFS = false;
            }
            
            return memory;
        }
        
        /// <summary>
        /// Get NeoFS URL for a memory's content.
        /// </summary>
        [Safe]
        public static string GetMemoryContentUrl(BigInteger memoryId, string gatewayHost = "")
        {
            Memory memory = GetMemory(memoryId);
            
            if (!memory.IsNeoFS)
            {
                // Hash-only mode: no direct URL
                return "";
            }
            
            if (string.IsNullOrEmpty(gatewayHost))
            {
                return $"neofs://{memory.NeoFSContainerId}/{memory.NeoFSObjectId}";
            }
            
            return $"{gatewayHost}/{memory.NeoFSContainerId}/{memory.NeoFSObjectId}";
        }
        
        /// <summary>
        /// Get memorial media assets stored in NeoFS.
        /// </summary>
        [Safe]
        public static MemorialMedia GetMemorialMedia(BigInteger memorialId)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_MEDIA_REF, (ByteString)memorialId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            
            if (data == null) return new MemorialMedia();
            
            return (MemorialMedia)StdLib.Deserialize(data);
        }
        
        /// <summary>
        /// Check if a memory is stored in NeoFS.
        /// </summary>
        [Safe]
        public static bool IsMemoryInNeoFS(BigInteger memoryId)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORY_NEFOS_CONTAINER, (ByteString)memoryId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key) != null;
        }
        
        /// <summary>
        /// Check if memorial has media assets.
        /// </summary>
        [Safe]
        public static bool HasMemorialMedia(BigInteger memorialId)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_MEDIA_REF, (ByteString)memorialId.ToByteArray());
            return Storage.Get(Storage.CurrentContext, key) != null;
        }
        
        // Helper methods
        private static string GetMemoryNeoFSObjectId(BigInteger memoryId)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORY_NEFOS_OBJECT, (ByteString)memoryId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data?.ToString() ?? "";
        }
        
        private static BigInteger GetMemoryContentSize(BigInteger memoryId)
        {
            byte[] key = Helper.Concat(PREFIX_MEMORY_NEFOS_SIZE, (ByteString)memoryId.ToByteArray());
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }
        
        #endregion

        #region Enhanced Write Methods
        
        /// <summary>
        /// Bury a memory with NeoFS storage.
        /// Enhanced version of BuryMemory with NeoFS support.
        /// </summary>
        public static BigInteger BuryMemoryNeoFS(
            UInt160 owner, 
            string contentHash, 
            BigInteger memoryType, 
            BigInteger contentSize,
            bool encrypted,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            ExecutionEngine.Assert(contentHash.Length > 0, "invalid content hash");
            ExecutionEngine.Assert(memoryType >= 1 && memoryType <= 5, "invalid type");
            ExecutionEngine.Assert(contentSize > 0, "invalid content size");
            
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");
            
            ValidatePaymentReceipt(APP_ID, owner, BURY_FEE, receiptId);
            
            UserStats stats = GetUserStatsData(owner);
            bool isNewUser = stats.JoinTime == 0;
            
            BigInteger memoryId = TotalMemories() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORY_ID, memoryId);
            
            // Create memory with NeoFS flag
            Memory memory = new Memory
            {
                Owner = owner,
                ContentHash = contentHash,
                MemoryType = memoryType,
                BuriedTime = Runtime.Time,
                ForgottenTime = 0,
                Epitaph = "",
                Forgotten = false,
                IsNeoFS = true,
                ContentSize = contentSize
            };
            
            StoreMemory(memoryId, memory);
            
            // Store NeoFS metadata
            Storage.Put(Storage.CurrentContext, 
                Helper.Concat(PREFIX_MEMORY_NEFOS_SIZE, (ByteString)memoryId.ToByteArray()), 
                contentSize);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_MEMORY_NEFOS_ENCRYPTED, (ByteString)memoryId.ToByteArray()),
                encrypted ? 1 : 0);
            
            AddUserMemory(owner, memoryId);
            UpdateTotalBuried();
            UpdateUserStatsOnBury(owner, memoryType, BURY_FEE, isNewUser);
            
            OnMemoryBuried(memoryId, owner, contentHash, memoryType);
            return memoryId;
        }
        
        /// <summary>
        /// Complete NeoFS memory upload (called by oracle after upload).
        /// </summary>
        public static bool CompleteMemoryNeoFSUpload(
            BigInteger memoryId,
            string containerId,
            string objectId)
        {
            ValidateGateway();
            
            ExecutionEngine.Assert(memoryId > 0 && memoryId <= TotalMemories(), "invalid memoryId");
            ExecutionEngine.Assert(containerId.Length > 0, "invalid containerId");
            ExecutionEngine.Assert(objectId.Length > 0, "invalid objectId");
            
            // Store NeoFS reference
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_MEMORY_NEFOS_CONTAINER, (ByteString)memoryId.ToByteArray()),
                containerId);
            Storage.Put(Storage.CurrentContext,
                Helper.Concat(PREFIX_MEMORY_NEFOS_OBJECT, (ByteString)memoryId.ToByteArray()),
                objectId);
            
            OnMemoryStoredInNeoFS(memoryId, containerId, objectId);
            return true;
        }
        
        /// <summary>
        /// Add epitaph with NeoFS support for long content.
        /// Small epitaphs stored on-chain, large ones in NeoFS.
        /// </summary>
        public static void AddEpitaphEnhanced(BigInteger memoryId, string epitaph, bool useNeoFS)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            Memory memory = GetMemory(memoryId);
            ExecutionEngine.Assert(Runtime.CheckWitness(memory.Owner), "unauthorized");
            ExecutionEngine.Assert(!memory.Forgotten, "memory forgotten");
            
            if (useNeoFS)
            {
                // Large epitaph: store reference, actual content in NeoFS
                ExecutionEngine.Assert(epitaph.Length > 0, "invalid epitaph");
                // In production, epitaph would be uploaded to NeoFS first
                // Here we just mark it as NeoFS-stored
                Storage.Put(Storage.CurrentContext,
                    Helper.Concat(PREFIX_EPITAPH_NEFOS_REF, (ByteString)memoryId.ToByteArray()),
                    1);
                memory.Epitaph = $"[NeoFS:{epitaph.Substring(0, 20)}...]";  // Truncated reference
            }
            else
            {
                // Small epitaph: store on-chain
                ExecutionEngine.Assert(epitaph.Length > 0 && epitaph.Length <= MAX_EPITAPH_LENGTH, 
                    "invalid epitaph");
                memory.Epitaph = epitaph;
            }
            
            StoreMemory(memoryId, memory);
            OnEpitaphAdded(memoryId, epitaph);
        }
        
        /// <summary>
        /// Add media assets to a memorial (photos, audio).
        /// Stores references in NeoFS.
        /// </summary>
        public static bool AddMemorialMedia(
            BigInteger memorialId,
            string photoContainerId,
            string photoObjectId,
            ByteString photoHash,
            string audioContainerId,
            string audioObjectId,
            ByteString audioHash)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Active, "memorial not active");
            ExecutionEngine.Assert(Runtime.CheckWitness(memorial.Creator), "not creator");
            
            MemorialMedia media = new MemorialMedia
            {
                MemorialId = memorialId,
                PhotoContainerId = photoContainerId ?? "",
                PhotoObjectId = photoObjectId ?? "",
                PhotoHash = photoHash,
                AudioContainerId = audioContainerId ?? "",
                AudioObjectId = audioObjectId ?? "",
                AudioHash = audioHash,
                UploadedAt = Runtime.Time
            };
            
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_MEDIA_REF, (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(media));
            
            if (!string.IsNullOrEmpty(photoContainerId))
            {
                OnMemorialMediaAdded(memorialId, "photo");
            }
            if (!string.IsNullOrEmpty(audioContainerId))
            {
                OnMemorialMediaAdded(memorialId, "audio");
            }
            
            return true;
        }
        
        /// <summary>
        /// Forget a memory with NeoFS cleanup.
        /// </summary>
        public static void ForgetMemoryNeoFS(UInt160 owner, BigInteger memoryId, BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            Memory memory = GetMemory(memoryId);
            ExecutionEngine.Assert(memory.Owner == owner, "not owner");
            ExecutionEngine.Assert(!memory.Forgotten, "already forgotten");
            
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(owner), "unauthorized");
            
            ValidatePaymentReceipt(APP_ID, owner, FORGET_FEE, receiptId);
            
            memory.Forgotten = true;
            memory.ForgottenTime = Runtime.Time;
            memory.ContentHash = "";
            
            // If stored in NeoFS, we don't delete (immutability)
            // But we remove the reference
            if (memory.IsNeoFS)
            {
                memory.NeoFSContainerId = "";
                memory.NeoFSObjectId = "";
                Storage.Delete(Storage.CurrentContext,
                    Helper.Concat(PREFIX_MEMORY_NEFOS_CONTAINER, (ByteString)memoryId.ToByteArray()));
                Storage.Delete(Storage.CurrentContext,
                    Helper.Concat(PREFIX_MEMORY_NEFOS_OBJECT, (ByteString)memoryId.ToByteArray()));
            }
            
            StoreMemory(memoryId, memory);
            
            UpdateTotalForgotten();
            UpdateUserStatsOnForget(owner, FORGET_FEE);
            
            OnMemoryForgotten(memoryId, owner, Runtime.Time);
        }
        
        #endregion

        #region Verification Methods
        
        /// <summary>
        /// Verify memory content integrity using content hash.
        /// </summary>
        public static bool VerifyMemoryContent(BigInteger memoryId, ByteString computedHash)
        {
            Memory memory = GetMemory(memoryId);
            if (memory.Forgotten) return false;
            
            ByteString storedHash = (ByteString)memory.ContentHash;
            return storedHash.Equals(computedHash);
        }
        
        /// <summary>
        /// Verify memorial media integrity.
        /// </summary>
        public static bool[] VerifyMemorialMedia(BigInteger memorialId, ByteString photoHash, ByteString audioHash)
        {
            MemorialMedia media = GetMemorialMedia(memorialId);
            bool photoValid = false;
            bool audioValid = false;
            
            if (!string.IsNullOrEmpty(media.PhotoContainerId) && photoHash != null)
            {
                photoValid = media.PhotoHash.Equals(photoHash);
            }
            
            if (!string.IsNullOrEmpty(media.AudioContainerId) && audioHash != null)
            {
                audioValid = media.AudioHash.Equals(audioHash);
            }
            
            return new bool[] { photoValid, audioValid };
        }
        
        #endregion

        #region Batch Operations
        
        /// <summary>
        /// Get multiple memory content URLs in batch.
        /// </summary>
        [Safe]
        public static string[] GetMemoryContentUrls(BigInteger[] memoryIds, string gatewayHost)
        {
            if (memoryIds == null) return new string[0];
            
            string[] urls = new string[memoryIds.Length];
            for (int i = 0; i < memoryIds.Length; i++)
            {
                urls[i] = GetMemoryContentUrl(memoryIds[i], gatewayHost);
            }
            return urls;
        }
        
        /// <summary>
        /// Get memories filtered by storage type.
        /// </summary>
        [Safe]
        public static BigInteger[] GetMemoriesByStorageType(UInt160 owner, bool isNeoFS)
        {
            BigInteger count = GetUserMemoryCount(owner);
            BigInteger[] temp = new BigInteger[(int)count];
            BigInteger found = 0;
            
            for (BigInteger i = 0; i < count; i++)
            {
                BigInteger memoryId = GetUserMemoryAt(owner, i);
                if (IsMemoryInNeoFS(memoryId) == isNeoFS)
                {
                    temp[(int)found] = memoryId;
                    found++;
                }
            }
            
            // Return properly sized array
            BigInteger[] result = new BigInteger[(int)found];
            for (int i = 0; i < (int)found; i++)
            {
                result[i] = temp[i];
            }
            return result;
        }
        
        #endregion
    }
}

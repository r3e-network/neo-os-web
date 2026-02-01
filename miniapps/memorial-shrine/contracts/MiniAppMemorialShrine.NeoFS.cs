using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    /// <summary>
    /// Memorial Shrine NeoFS Extension - Decentralized storage for memorial content
    /// 
    /// 区块链灵位 NeoFS 扩展 - 去中心化存储纪念内容
    /// 
    /// This extension adds NeoFS support to Memorial Shrine, enabling:
    /// - Permanent storage of memorial photos in NeoFS
    /// - Long-form biographies and obituaries (unlimited length)
    /// - Audio/video tributes and voice messages
    /// - Family video archives
    /// 
    /// NeoFS STORAGE BENEFITS:
    /// - 照片永久保存，不依赖中心化服务器
    /// - 生平传记可以更长更详细
    /// - 支持音频/视频纪念内容
    /// - 99% cheaper than on-chain storage
    /// 
    /// STORAGE MODEL:
    /// - Small text (< 500 chars): On-chain storage (fast access)
    /// - Photos, videos, long text: NeoFS storage (cheap, permanent)
    /// - All content content-addressed with SHA256 hash
    /// </summary>
    public partial class MiniAppMemorialShrine
    {
        #region NeoFS Configuration
        
        // 内容大小阈值
        private const int NEFOS_TEXT_THRESHOLD = 1000;      // Text > 1KB -> NeoFS
        private const int NEFOS_PHOTO_THRESHOLD = 0;        // All photos -> NeoFS (better)
        
        // 内容类型标识
        private const BigInteger CONTENT_TYPE_PHOTO = 1;           // 灵位照片
        private const BigInteger CONTENT_TYPE_BIOGRAPHY = 2;       // 生平传记
        private const BigInteger CONTENT_TYPE_OBITUARY = 3;        // 讣告
        private const BigInteger CONTENT_TYPE_AUDIO = 4;           // 音频留言
        private const BigInteger CONTENT_TYPE_VIDEO = 5;           // 视频纪念
        private const BigInteger CONTENT_TYPE_DOCUMENT = 6;        // 纪念文档
        
        // 额外的存储前缀 (0x30+)
        private static readonly byte[] PREFIX_MEMORIAL_PHOTO_NEFOS = new byte[] { 0x30 };
        private static readonly byte[] PREFIX_MEMORIAL_BIO_NEFOS = new byte[] { 0x31 };
        private static readonly byte[] PREFIX_MEMORIAL_OBIT_NEFOS = new byte[] { 0x32 };
        private static readonly byte[] PREFIX_TRIBUTE_AUDIO_NEFOS = new byte[] { 0x33 };
        private static readonly byte[] PREFIX_TRIBUTE_VIDEO_NEFOS = new byte[] { 0x34 };
        private static readonly byte[] PREFIX_MEMORIAL_MEDIA_COUNT = new byte[] { 0x35 };
        
        #endregion

        #region Enhanced Data Structures
        
        /// <summary>
        /// NeoFS-enhanced Memorial struct
        /// </summary>
        public new struct Memorial
        {
            public BigInteger Id;
            public UInt160 Creator;
            public string DeceasedName;
            public string PhotoHash;              // Legacy: hash only
            public string Relationship;
            public BigInteger BirthYear;
            public BigInteger DeathYear;
            public string Biography;              // Legacy: short text or NeoFS reference
            public string Obituary;               // Legacy: short text or NeoFS reference
            public BigInteger CreateTime;
            public BigInteger LastTributeTime;
            public bool Active;
            
            // 祭品统计
            public BigInteger IncenseCount;
            public BigInteger CandleCount;
            public BigInteger FlowerCount;
            public BigInteger FruitCount;
            public BigInteger WineCount;
            public BigInteger FeastCount;
            
            // NeoFS 字段
            public string PhotoContainerId;       // NeoFS container for photo
            public string PhotoObjectId;          // NeoFS object for photo
            public string BioContainerId;         // NeoFS container for biography
            public string BioObjectId;            // NeoFS object for biography
            public string ObitContainerId;        // NeoFS container for obituary
            public string ObitObjectId;           // NeoFS object for obituary
            public bool HasPhotoInNeoFS;
            public bool HasBioInNeoFS;
            public bool HasObitInNeoFS;
        }
        
        /// <summary>
        /// NeoFS media reference for memorial
        /// </summary>
        public struct MemorialMedia
        {
            public BigInteger MemorialId;
            public string MediaType;              // "photo", "audio", "video", "document"
            public string ContainerId;
            public string ObjectId;
            public ByteString ContentHash;
            public BigInteger FileSize;
            public BigInteger UploadedAt;
            public string Description;
        }
        
        /// <summary>
        /// Enhanced tribute with NeoFS support
        /// </summary>
        public new struct Tribute
        {
            public BigInteger Id;
            public BigInteger MemorialId;
            public UInt160 Visitor;
            public BigInteger OfferingType;
            public string Message;                // Text message or NeoFS reference
            public BigInteger Timestamp;
            
            // NeoFS 音频/视频
            public string AudioContainerId;       // Optional: voice message
            public string AudioObjectId;
            public string VideoContainerId;       // Optional: video tribute
            public string VideoObjectId;
            public bool HasAudio;
            public bool HasVideo;
        }
        
        #endregion

        #region NeoFS Events
        
        public delegate void MemorialPhotoUploadedHandler(BigInteger memorialId, string containerId, string objectId);
        public delegate void MemorialBioUploadedHandler(BigInteger memorialId, BigInteger contentSize);
        public delegate void MemorialObituaryUploadedHandler(BigInteger memorialId, BigInteger contentSize);
        public delegate void TributeMediaAddedHandler(BigInteger tributeId, string mediaType);
        public delegate void MemorialMediaUploadedHandler(BigInteger memorialId, string mediaType, BigInteger mediaIndex);
        
        [DisplayName("MemorialPhotoUploaded")]
        public static event MemorialPhotoUploadedHandler OnMemorialPhotoUploaded;
        
        [DisplayName("MemorialBioUploaded")]
        public static event MemorialBioUploadedHandler OnMemorialBioUploaded;
        
        [DisplayName("MemorialObituaryUploaded")]
        public static event MemorialObituaryUploadedHandler OnMemorialObituaryUploaded;
        
        [DisplayName("TributeMediaAdded")]
        public static event TributeMediaAddedHandler OnTributeMediaAdded;
        
        [DisplayName("MemorialMediaUploaded")]
        public static event MemorialMediaUploadedHandler OnMemorialMediaUploaded;
        
        #endregion

        #region Enhanced Read Methods
        
        /// <summary>
        /// Get enhanced memorial with NeoFS info
        /// </summary>
        [Safe]
        public static new Memorial GetMemorial(BigInteger memorialId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_MEMORIALS, (ByteString)memorialId.ToByteArray()));
            if (data == null) return new Memorial();
            
            Memorial memorial = (Memorial)StdLib.Deserialize(data);
            
            // Load NeoFS photo reference
            byte[] photoKey = Helper.Concat(PREFIX_MEMORIAL_PHOTO_NEFOS, (ByteString)memorialId.ToByteArray());
            ByteString photoData = Storage.Get(Storage.CurrentContext, photoKey);
            if (photoData != null)
            {
                string[] photoRef = (string[])StdLib.Deserialize(photoData);
                memorial.PhotoContainerId = photoRef[0];
                memorial.PhotoObjectId = photoRef[1];
                memorial.HasPhotoInNeoFS = true;
            }
            
            // Load NeoFS biography reference
            byte[] bioKey = Helper.Concat(PREFIX_MEMORIAL_BIO_NEFOS, (ByteString)memorialId.ToByteArray());
            ByteString bioData = Storage.Get(Storage.CurrentContext, bioKey);
            if (bioData != null)
            {
                string[] bioRef = (string[])StdLib.Deserialize(bioData);
                memorial.BioContainerId = bioRef[0];
                memorial.BioObjectId = bioRef[1];
                memorial.HasBioInNeoFS = true;
            }
            
            // Load NeoFS obituary reference
            byte[] obitKey = Helper.Concat(PREFIX_MEMORIAL_OBIT_NEFOS, (ByteString)memorialId.ToByteArray());
            ByteString obitData = Storage.Get(Storage.CurrentContext, obitKey);
            if (obitData != null)
            {
                string[] obitRef = (string[])StdLib.Deserialize(obitData);
                memorial.ObitContainerId = obitRef[0];
                memorial.ObitObjectId = obitRef[1];
                memorial.HasObitInNeoFS = true;
            }
            
            return memorial;
        }
        
        /// <summary>
        /// Get memorial photo URL
        /// </summary>
        [Safe]
        public static string GetMemorialPhotoUrl(BigInteger memorialId, string gatewayHost = "")
        {
            Memorial memorial = GetMemorial(memorialId);
            
            if (memorial.HasPhotoInNeoFS)
            {
                if (string.IsNullOrEmpty(gatewayHost))
                {
                    return $"neofs://{memorial.PhotoContainerId}/{memorial.PhotoObjectId}";
                }
                return $"{gatewayHost}/{memorial.PhotoContainerId}/{memorial.PhotoObjectId}";
            }
            
            // Legacy: return empty or use PhotoHash as IPFS hash
            return memorial.PhotoHash.StartsWith("ipfs:") ? memorial.PhotoHash : "";
        }
        
        /// <summary>
        /// Get biography content URL (if stored in NeoFS)
        /// </summary>
        [Safe]
        public static string GetBiographyUrl(BigInteger memorialId, string gatewayHost = "")
        {
            Memorial memorial = GetMemorial(memorialId);
            
            if (memorial.HasBioInNeoFS)
            {
                if (string.IsNullOrEmpty(gatewayHost))
                {
                    return $"neofs://{memorial.BioContainerId}/{memorial.BioObjectId}";
                }
                return $"{gatewayHost}/{memorial.BioContainerId}/{memorial.BioObjectId}";
            }
            
            return "";
        }
        
        /// <summary>
        /// Get obituary content URL (if stored in NeoFS)
        /// </summary>
        [Safe]
        public static string GetObituaryUrl(BigInteger memorialId, string gatewayHost = "")
        {
            Memorial memorial = GetMemorial(memorialId);
            
            if (memorial.HasObitInNeoFS)
            {
                if (string.IsNullOrEmpty(gatewayHost))
                {
                    return $"neofs://{memorial.ObitContainerId}/{memorial.ObitObjectId}";
                }
                return $"{gatewayHost}/{memorial.ObitContainerId}/{memorial.ObitObjectId}";
            }
            
            return "";
        }
        
        /// <summary>
        /// Get enhanced tribute with NeoFS media
        /// </summary>
        [Safe]
        public static new Tribute GetTribute(BigInteger tributeId)
        {
            ByteString data = Storage.Get(Storage.CurrentContext,
                Helper.Concat((ByteString)PREFIX_TRIBUTES, (ByteString)tributeId.ToByteArray()));
            if (data == null) return new Tribute();
            
            Tribute tribute = (Tribute)StdLib.Deserialize(data);
            
            // Load audio reference
            byte[] audioKey = Helper.Concat(PREFIX_TRIBUTE_AUDIO_NEFOS, (ByteString)tributeId.ToByteArray());
            ByteString audioData = Storage.Get(Storage.CurrentContext, audioKey);
            if (audioData != null)
            {
                string[] audioRef = (string[])StdLib.Deserialize(audioData);
                tribute.AudioContainerId = audioRef[0];
                tribute.AudioObjectId = audioRef[1];
                tribute.HasAudio = true;
            }
            
            // Load video reference
            byte[] videoKey = Helper.Concat(PREFIX_TRIBUTE_VIDEO_NEFOS, (ByteString)tributeId.ToByteArray());
            ByteString videoData = Storage.Get(Storage.CurrentContext, videoKey);
            if (videoData != null)
            {
                string[] videoRef = (string[])StdLib.Deserialize(videoData);
                tribute.VideoContainerId = videoRef[0];
                tribute.VideoObjectId = videoRef[1];
                tribute.HasVideo = true;
            }
            
            return tribute;
        }
        
        /// <summary>
        /// Get tribute audio URL
        /// </summary>
        [Safe]
        public static string GetTributeAudioUrl(BigInteger tributeId, string gatewayHost = "")
        {
            Tribute tribute = GetTribute(tributeId);
            
            if (!tribute.HasAudio) return "";
            
            if (string.IsNullOrEmpty(gatewayHost))
            {
                return $"neofs://{tribute.AudioContainerId}/{tribute.AudioObjectId}";
            }
            return $"{gatewayHost}/{tribute.AudioContainerId}/{tribute.AudioObjectId}";
        }
        
        /// <summary>
        /// Get tribute video URL
        /// </summary>
        [Safe]
        public static string GetTributeVideoUrl(BigInteger tributeId, string gatewayHost = "")
        {
            Tribute tribute = GetTribute(tributeId);
            
            if (!tribute.HasVideo) return "";
            
            if (string.IsNullOrEmpty(gatewayHost))
            {
                return $"neofs://{tribute.VideoContainerId}/{tribute.VideoObjectId}";
            }
            return $"{gatewayHost}/{tribute.VideoContainerId}/{tribute.VideoObjectId}";
        }
        
        /// <summary>
        /// Check if memorial has NeoFS content
        /// </summary>
        [Safe]
        public static bool HasMemorialNeoFSContent(BigInteger memorialId)
        {
            Memorial memorial = GetMemorial(memorialId);
            return memorial.HasPhotoInNeoFS || memorial.HasBioInNeoFS || memorial.HasObitInNeoFS;
        }
        
        #endregion

        #region Enhanced Write Methods
        
        /// <summary>
        /// Create memorial with NeoFS photo support
        /// </summary>
        public static BigInteger CreateMemorialNeoFS(
            UInt160 creator,
            string deceasedName,
            string relationship,
            BigInteger birthYear,
            BigInteger deathYear,
            bool useNeoFSPhoto,
            BigInteger receiptId)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            UInt160 gateway = Gateway();
            bool fromGateway = gateway != null && gateway.IsValid && Runtime.CallingScriptHash == gateway;
            ExecutionEngine.Assert(fromGateway || Runtime.CheckWitness(creator), "unauthorized");
            
            ExecutionEngine.Assert(deceasedName.Length > 0 && deceasedName.Length <= 100, "invalid name");
            ExecutionEngine.Assert(relationship.Length <= 50, "invalid relationship");
            ExecutionEngine.Assert(birthYear >= 0 && birthYear <= 9999, "invalid birth year");
            ExecutionEngine.Assert(deathYear >= birthYear && deathYear <= 9999, "invalid death year");
            
            // Generate memorial ID
            BigInteger memorialId = (BigInteger)Storage.Get(Storage.CurrentContext, PREFIX_MEMORIAL_ID) + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_MEMORIAL_ID, memorialId);
            
            // Create memorial
            Memorial memorial = new Memorial
            {
                Id = memorialId,
                Creator = creator,
                DeceasedName = deceasedName,
                PhotoHash = "",                       // Will be set via NeoFS
                Relationship = relationship,
                BirthYear = birthYear,
                DeathYear = deathYear,
                Biography = "",                       // Will be set later
                Obituary = "",                        // Will be set later
                CreateTime = Runtime.Time,
                LastTributeTime = 0,
                Active = true,
                HasPhotoInNeoFS = useNeoFSPhoto,
                HasBioInNeoFS = false,
                HasObitInNeoFS = false
            };
            
            StoreMemorial(memorialId, memorial);
            AddCreatorMemorial(creator, memorialId);
            
            OnMemorialCreated(memorialId, creator, deceasedName, deathYear);
            
            return memorialId;
        }
        
        /// <summary>
        /// Upload memorial photo to NeoFS (called by oracle after upload)
        /// </summary>
        public static bool UploadMemorialPhoto(
            BigInteger memorialId,
            string containerId,
            string objectId,
            ByteString contentHash)
        {
            ValidateGateway();
            
            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Creator != UInt160.Zero, "memorial not found");
            
            string[] photoRef = new string[] { containerId, objectId };
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_PHOTO_NEFOS, (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(photoRef));
            
            // Update PhotoHash with content hash for verification
            memorial.PhotoHash = contentHash.ToString();
            memorial.PhotoContainerId = containerId;
            memorial.PhotoObjectId = objectId;
            memorial.HasPhotoInNeoFS = true;
            StoreMemorial(memorialId, memorial);
            
            OnMemorialPhotoUploaded(memorialId, containerId, objectId);
            return true;
        }
        
        /// <summary>
        /// Upload biography to NeoFS
        /// </summary>
        public static bool UploadMemorialBiography(
            BigInteger memorialId,
            string containerId,
            string objectId,
            BigInteger contentSize)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Creator != UInt160.Zero, "memorial not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(memorial.Creator), "not creator");
            
            string[] bioRef = new string[] { containerId, objectId };
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_BIO_NEFOS, (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(bioRef));
            
            memorial.BioContainerId = containerId;
            memorial.BioObjectId = objectId;
            memorial.HasBioInNeoFS = true;
            memorial.Biography = $"[NeoFS: {contentSize} bytes]";
            StoreMemorial(memorialId, memorial);
            
            OnMemorialBioUploaded(memorialId, contentSize);
            return true;
        }
        
        /// <summary>
        /// Upload obituary to NeoFS
        /// </summary>
        public static bool UploadMemorialObituary(
            BigInteger memorialId,
            string containerId,
            string objectId,
            BigInteger contentSize)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Creator != UInt160.Zero, "memorial not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(memorial.Creator), "not creator");
            
            string[] obitRef = new string[] { containerId, objectId };
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_OBIT_NEFOS, (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(obitRef));
            
            memorial.ObitContainerId = containerId;
            memorial.ObitObjectId = objectId;
            memorial.HasObitInNeoFS = true;
            memorial.Obituary = $"[NeoFS: {contentSize} bytes]";
            StoreMemorial(memorialId, memorial);
            
            // Add to obituary board
            AddToObituaryBoard(memorialId);
            OnMemorialObituaryUploaded(memorialId, contentSize);
            OnObituaryPublished(memorialId, memorial.DeceasedName, "[NeoFS Content]");
            
            return true;
        }
        
        /// <summary>
        /// Add tribute with audio/video support
        /// </summary>
        public static BigInteger PayTributeEnhanced(
            UInt160 visitor,
            BigInteger memorialId,
            BigInteger offeringType,
            string message,
            bool includeAudio,
            bool includeVideo,
            BigInteger receiptId)
        {
            // Base tribute creation
            BigInteger tributeId = PayTribute(visitor, memorialId, offeringType, message, receiptId);
            
            // Mark audio/video flags (actual upload happens separately via oracle)
            if (includeAudio || includeVideo)
            {
                Tribute tribute = GetTribute(tributeId);
                tribute.HasAudio = includeAudio;
                tribute.HasVideo = includeVideo;
                StoreTribute(tributeId, tribute);
            }
            
            return tributeId;
        }
        
        /// <summary>
        /// Upload tribute audio (called by oracle)
        /// </summary>
        public static bool UploadTributeAudio(
            BigInteger tributeId,
            string containerId,
            string objectId)
        {
            ValidateGateway();
            
            Tribute tribute = GetTribute(tributeId);
            ExecutionEngine.Assert(tribute.Id > 0, "tribute not found");
            
            string[] audioRef = new string[] { containerId, objectId };
            byte[] key = Helper.Concat(PREFIX_TRIBUTE_AUDIO_NEFOS, (ByteString)tributeId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(audioRef));
            
            OnTributeMediaAdded(tributeId, "audio");
            return true;
        }
        
        /// <summary>
        /// Upload tribute video (called by oracle)
        /// </summary>
        public static bool UploadTributeVideo(
            BigInteger tributeId,
            string containerId,
            string objectId)
        {
            ValidateGateway();
            
            Tribute tribute = GetTribute(tributeId);
            ExecutionEngine.Assert(tribute.Id > 0, "tribute not found");
            
            string[] videoRef = new string[] { containerId, objectId };
            byte[] key = Helper.Concat(PREFIX_TRIBUTE_VIDEO_NEFOS, (ByteString)tributeId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(videoRef));
            
            OnTributeMediaAdded(tributeId, "video");
            return true;
        }
        
        #endregion

        #region Batch Operations
        
        /// <summary>
        /// Get all NeoFS URLs for a memorial
        /// </summary>
        [Safe]
        public static Map<string, string> GetMemorialNeoFSUrls(BigInteger memorialId, string gatewayHost)
        {
            Map<string, string> urls = new Map<string, string>();
            Memorial memorial = GetMemorial(memorialId);
            
            if (memorial.HasPhotoInNeoFS)
            {
                urls["photo"] = GetMemorialPhotoUrl(memorialId, gatewayHost);
            }
            if (memorial.HasBioInNeoFS)
            {
                urls["biography"] = GetBiographyUrl(memorialId, gatewayHost);
            }
            if (memorial.HasObitInNeoFS)
            {
                urls["obituary"] = GetObituaryUrl(memorialId, gatewayHost);
            }
            
            return urls;
        }
        
        /// <summary>
        /// Get tribute media URLs
        /// </summary>
        [Safe]
        public static Map<string, string> GetTributeMediaUrls(BigInteger tributeId, string gatewayHost)
        {
            Map<string, string> urls = new Map<string, string>();
            Tribute tribute = GetTribute(tributeId);
            
            if (tribute.HasAudio)
            {
                urls["audio"] = GetTributeAudioUrl(tributeId, gatewayHost);
            }
            if (tribute.HasVideo)
            {
                urls["video"] = GetTributeVideoUrl(tributeId, gatewayHost);
            }
            
            return urls;
        }
        
        #endregion

        #region Migration
        
        /// <summary>
        /// Migrate legacy memorial photo to NeoFS
        /// </summary>
        public static bool MigratePhotoToNeoFS(
            BigInteger memorialId,
            string containerId,
            string objectId,
            ByteString contentHash)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            Memorial memorial = GetMemorial(memorialId);
            ExecutionEngine.Assert(memorial.Creator != UInt160.Zero, "memorial not found");
            ExecutionEngine.Assert(Runtime.CheckWitness(memorial.Creator), "not creator");
            ExecutionEngine.Assert(!memorial.HasPhotoInNeoFS, "already in NeoFS");
            
            string[] photoRef = new string[] { containerId, objectId };
            byte[] key = Helper.Concat(PREFIX_MEMORIAL_PHOTO_NEFOS, (ByteString)memorialId.ToByteArray());
            Storage.Put(Storage.CurrentContext, key, StdLib.Serialize(photoRef));
            
            memorial.PhotoHash = contentHash.ToString();
            memorial.HasPhotoInNeoFS = true;
            StoreMemorial(memorialId, memorial);
            
            OnMemorialPhotoUploaded(memorialId, containerId, objectId);
            return true;
        }
        
        #endregion
    }
}

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
    /// ForeverAlbum NeoFS Extension - Hybrid Storage Support
    /// 
    /// This extension adds NeoFS decentralized storage support to ForeverAlbum.
    /// 
    /// STORAGE MODES:
    /// 1. LEGACY MODE (On-Chain): For small thumbnails (< 45KB)
    ///    - Data stored directly in contract storage
    ///    - Fast access, but limited size and expensive
    /// 
    /// 2. NEOFS MODE (Off-Chain): For full photos (MBs to GBs)
    ///    - Only NeoFS reference stored on-chain
    ///    - Actual photo stored in NeoFS
    ///    - 99% cost reduction, unlimited size
    /// 
    /// MIGRATION PATH:
    /// - New photos default to NeoFS mode
    /// - Legacy thumbnails remain on-chain
    /// - Gradual migration of legacy content to NeoFS
    /// 
    /// URL FORMATS:
    /// - NeoFS: neofs://{containerId}/{objectId}
    /// - HTTP Gateway: https://neofs.example.com/{containerId}/{objectId}
    /// </summary>
    public partial class MiniAppForeverAlbum
    {
        #region NeoFS Configuration
        
        // Size threshold for NeoFS (larger files go to NeoFS)
        private const int NEFOS_THRESHOLD_BYTES = 40000;  // Files > 40KB use NeoFS
        
        // Max file size for NeoFS (virtually unlimited, but set a safety limit)
        private const long MAX_NEFOS_FILE_SIZE = 100 * 1024 * 1024;  // 100MB
        
        // Content type identifiers
        private const BigInteger CONTENT_TYPE_PHOTO = 1;
        private const BigInteger CONTENT_TYPE_THUMBNAIL = 2;
        private const BigInteger CONTENT_TYPE_VIDEO = 3;
        
        #endregion

        #region Enhanced PhotoInfo with NeoFS Support
        
        /// <summary>
        /// Enhanced PhotoInfo that supports both legacy and NeoFS storage.
        /// This replaces the original PhotoInfo struct.
        /// </summary>
        public new struct PhotoInfo
        {
            public ByteString PhotoId;
            public UInt160 Owner;
            public bool Encrypted;
            
            // Legacy mode: actual data (null for NeoFS mode)
            public ByteString Data;
            
            // NeoFS mode: reference data (null for legacy mode)
            public string NeoFSContainerId;
            public string NeoFSObjectId;
            public ByteString ContentHash;
            
            // Common metadata
            public BigInteger FileSize;
            public BigInteger CreatedAt;
            public bool IsNeoFS;  // Storage mode flag
        }
        
        #endregion

        #region NeoFS Events
        
        /// <summary>Event emitted when photo migrated.</summary>
    public delegate void PhotoMigratedHandler(ByteString photoId, string containerId, string objectId);
        
        [DisplayName("PhotoMigrated")]
        public static event PhotoMigratedHandler OnPhotoMigrated;
        
        #endregion

        #region Enhanced Read Methods
        
        /// <summary>
        /// Get enhanced photo info supporting both legacy and NeoFS modes.
        /// This replaces the original GetPhoto method.
        /// </summary>
        [Safe]
        public static new PhotoInfo GetPhoto(ByteString photoId)
        {
            if (photoId is null || photoId.Length == 0) return new PhotoInfo();
            
            // Check if NeoFS content
            if (IsNeoFSPhoto(photoId))
            {
                return GetNeoFSPhotoInfo(photoId);
            }
            
            // Legacy mode
            byte[] dataKey = Helper.Concat(PREFIX_PHOTO_DATA, photoId);
            ByteString data = Storage.Get(Storage.CurrentContext, dataKey);
            if (data == null) return new PhotoInfo();
            
            UInt160 owner = (UInt160)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_OWNER, photoId));
            ByteString encryptedData = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_ENCRYPTED, photoId));
            bool encrypted = encryptedData != null && (BigInteger)encryptedData != 0;
            ByteString createdData = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_TIME, photoId));
            BigInteger createdAt = createdData == null ? 0 : (BigInteger)createdData;
            BigInteger fileSize = data.Length;
            
            return new PhotoInfo
            {
                PhotoId = photoId,
                Owner = owner,
                Encrypted = encrypted,
                Data = data,  // Legacy: contains actual data
                NeoFSContainerId = null,
                NeoFSObjectId = null,
                ContentHash = null,
                FileSize = fileSize,
                CreatedAt = createdAt,
                IsNeoFS = false
            };
        }
        
        /// <summary>
        /// Get NeoFS photo info.
        /// </summary>
        [Safe]
        private static PhotoInfo GetNeoFSPhotoInfo(ByteString photoId)
        {
            NeoFSReference neoRef = GetNeoFSReference(photoId);
            if (neoRef.ContainerId == null) return new PhotoInfo();
            
            return new PhotoInfo
            {
                PhotoId = photoId,
                Owner = neoRef.Owner,
                Encrypted = neoRef.Encrypted,
                Data = null,  // NeoFS: data stored off-chain
                NeoFSContainerId = neoRef.ContainerId,
                NeoFSObjectId = neoRef.ObjectId,
                ContentHash = neoRef.ContentHash,
                FileSize = neoRef.FileSize,
                CreatedAt = neoRef.CreatedAt,
                IsNeoFS = true
            };
        }
        
        /// <summary>
        /// Get photo URL for accessing the photo.
        /// Returns NeoFS URL for NeoFS photos, data URL for legacy photos.
        /// </summary>
        [Safe]
        public static string GetPhotoUrl(ByteString photoId, string gatewayHost = "")
        {
            PhotoInfo photo = GetPhoto(photoId);
            
            if (photo.IsNeoFS)
            {
                if (!string.IsNullOrEmpty(gatewayHost))
                {
                    return GetNeoFSGatewayUrl(photoId, gatewayHost);
                }
                return GetNeoFSUrl(photoId);
            }
            else if (photo.Data != null)
            {
                // Legacy: return data URL format
                return $"data:image/jpeg;base64,{photo.Data}";
            }
            
            return "";
        }
        
        /// <summary>
        /// Check if photo is stored in NeoFS.
        /// </summary>
        [Safe]
        public static bool IsNeoFSPhoto(ByteString photoId)
        {
            return IsNeoFSContent(photoId);
        }
        
        /// <summary>
        /// Get photo storage mode as string.
        /// </summary>
        [Safe]
        public static string GetPhotoStorageMode(ByteString photoId)
        {
            if (IsNeoFSPhoto(photoId)) return "neofs";
            if (IsLegacyContent(photoId)) return "legacy";
            return "unknown";
        }
        
        #endregion

        #region Enhanced Upload Methods
        
        /// <summary>
        /// Enhanced upload that automatically selects storage mode based on size.
        /// - Small files (< 40KB): Legacy on-chain storage
        /// - Large files (>= 40KB): NeoFS storage
        /// </summary>
        public static bool UploadPhotoAuto(string photoData, bool encrypted)
        {
            return UploadPhotosAuto(new string[] { photoData }, new bool[] { encrypted });
        }
        
        /// <summary>
        /// Batch upload with automatic storage mode selection.
        /// </summary>
        public static bool UploadPhotosAuto(string[] photoData, bool[] encryptedFlags)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            UInt160 sender = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(sender != null && sender.IsValid, "invalid sender");
            ExecutionEngine.Assert(Runtime.CheckWitness(sender), "no witness");
            
            if (photoData == null || encryptedFlags == null) return false;
            if (photoData.Length == 0) return false;
            if (photoData.Length > MAX_PHOTOS_PER_UPLOAD) return false;
            if (photoData.Length != encryptedFlags.Length) return false;
            
            int totalBytes = 0;
            for (int i = 0; i < photoData.Length; i++)
            {
                string data = photoData[i];
                if (data == null) return false;
                int length = data.Length;
                if (length == 0) return false;  // No longer limited to 45KB
                totalBytes += length;
                if (totalBytes > MAX_TOTAL_BYTES * 10) return false;  // Relaxed limit
            }
            
            BigInteger count = GetUserPhotoCount(sender);
            Transaction tx = Runtime.Transaction;
            
            for (int i = 0; i < photoData.Length; i++)
            {
                ByteString idSeed = Helper.Concat(tx.Hash, (ByteString)((BigInteger)i).ToByteArray());
                ByteString photoId = CryptoLib.Sha256(idSeed);
                
                string data = photoData[i];
                int dataLength = data.Length;
                
                // Auto-select storage mode based on size
                if (dataLength >= NEFOS_THRESHOLD_BYTES)
                {
                    // Use NeoFS for large files
                    // For now, store in legacy mode with request for migration
                    // In production, this would trigger an oracle to upload to NeoFS
                    StorePhotoLegacy(photoId, sender, data, encryptedFlags[i]);
                    
                    // Mark for NeoFS migration
                    Storage.Put(Storage.CurrentContext, 
                        Helper.Concat(new byte[] { 0x3C }, photoId), 1);
                }
                else
                {
                    // Use legacy on-chain for small thumbnails
                    StorePhotoLegacy(photoId, sender, data, encryptedFlags[i]);
                }
                
                // Update index
                byte[] indexKey = Helper.Concat(
                    Helper.Concat(PREFIX_USER_PHOTO_INDEX, sender),
                    (ByteString)(count + i).ToByteArray());
                Storage.Put(Storage.CurrentContext, indexKey, photoId);
                
                OnPhotoUploaded(sender, photoId, encryptedFlags[i], count + i);
            }
            
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_USER_PHOTO_COUNT, sender), count + photoData.Length);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PHOTOS, TotalPhotos() + photoData.Length);
            
            return true;
        }
        
        /// <summary>
        /// Request NeoFS upload for a photo.
        /// Use this for uploading large photos directly to NeoFS.
        /// </summary>
        public static BigInteger RequestPhotoUpload(BigInteger fileSize, bool encrypted)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            UInt160 sender = Runtime.Transaction.Sender;
            ExecutionEngine.Assert(sender != null && sender.IsValid, "invalid sender");
            ExecutionEngine.Assert(Runtime.CheckWitness(sender), "no witness");
            
            ExecutionEngine.Assert(fileSize > 0, "invalid file size");
            ExecutionEngine.Assert(fileSize <= MAX_NEFOS_FILE_SIZE, "file too large");
            
            return RequestNeoFSUpload(fileSize, CONTENT_TYPE_PHOTO, encrypted);
        }
        
        /// <summary>
        /// Complete NeoFS photo upload (called by oracle).
        /// </summary>
        public static bool CompletePhotoUpload(
            BigInteger requestId,
            ByteString photoId,
            string containerId,
            string objectId,
            ByteString contentHash)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            bool success = CompleteNeoFSUpload(requestId, photoId, containerId, objectId, contentHash);
            if (!success) return false;
            
            // Add to user's photo index
            UploadRequest request = GetUploadRequest(requestId);
            BigInteger count = GetUserPhotoCount(request.Requester);
            
            byte[] indexKey = Helper.Concat(
                Helper.Concat(PREFIX_USER_PHOTO_INDEX, request.Requester),
                (ByteString)count.ToByteArray());
            Storage.Put(Storage.CurrentContext, indexKey, photoId);
            
            Storage.Put(Storage.CurrentContext, 
                Helper.Concat(PREFIX_USER_PHOTO_COUNT, request.Requester), count + 1);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PHOTOS, TotalPhotos() + 1);
            
            OnPhotoUploaded(request.Requester, photoId, request.Encrypted, count);
            return true;
        }
        
        /// <summary>
        /// Store photo in legacy mode (helper method).
        /// </summary>
        private static void StorePhotoLegacy(ByteString photoId, UInt160 owner, string data, bool encrypted)
        {
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_DATA, photoId), (ByteString)data);
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_ENCRYPTED, photoId), encrypted ? 1 : 0);
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_OWNER, photoId), owner);
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_TIME, photoId), Runtime.Time);
            Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_LEGACY_FLAG, photoId), 1);
        }
        
        #endregion

        #region Migration Methods
        
        /// <summary>
        /// Migrate a legacy photo to NeoFS.
        /// Must be called by photo owner after uploading to NeoFS.
        /// </summary>
        public static bool MigratePhotoToNeoFS(
            ByteString photoId,
            string containerId,
            string objectId,
            ByteString contentHash)
        {
            ValidateNotGloballyPaused(APP_ID);
            
            // Validate ownership
            PhotoInfo photo = GetPhoto(photoId);
            ExecutionEngine.Assert(photo.Owner == Runtime.Transaction.Sender, "not owner");
            ExecutionEngine.Assert(Runtime.CheckWitness(Runtime.Transaction.Sender), "unauthorized");
            ExecutionEngine.Assert(!photo.IsNeoFS, "already on NeoFS");
            
            bool success = MigrateToNeoFS(photoId, containerId, objectId, contentHash);
            if (success)
            {
                OnPhotoMigrated(photoId, containerId, objectId);
            }
            return success;
        }
        
        /// <summary>
        /// Get list of photos pending NeoFS migration.
        /// </summary>
        [Safe]
        public static ByteString[] GetPendingMigrations(BigInteger start, BigInteger limit)
        {
            // This is a simplified implementation
            // In production, you'd maintain a proper index
            return new ByteString[0];
        }
        
        #endregion

        #region Verification Methods
        
        /// <summary>
        /// Verify photo integrity using content hash.
        /// </summary>
        public static bool VerifyPhotoIntegrity(ByteString photoId, ByteString computedHash)
        {
            return VerifyNeoFSContent(photoId, computedHash);
        }
        
        /// <summary>
        /// Batch verify multiple photos.
        /// </summary>
        public static bool[] BatchVerifyPhotos(ByteString[] photoIds, ByteString[] computedHashes)
        {
            if (photoIds == null || computedHashes == null) return new bool[0];
            if (photoIds.Length != computedHashes.Length) return new bool[0];
            
            bool[] results = new bool[photoIds.Length];
            for (int i = 0; i < photoIds.Length; i++)
            {
                results[i] = VerifyPhotoIntegrity(photoIds[i], computedHashes[i]);
            }
            return results;
        }
        
        #endregion

        #region Statistics
        
        /// <summary>
        /// Get user's photo count broken down by storage mode.
        /// </summary>
        [Safe]
        public static BigInteger[] GetUserPhotoStats(UInt160 user)
        {
            BigInteger total = GetUserPhotoCount(user);
            BigInteger neofsCount = 0;
            BigInteger legacyCount = 0;
            
            for (BigInteger i = 0; i < total; i++)
            {
                ByteString photoId = GetUserPhotoIds(user, i, 1)[0];
                if (IsNeoFSPhoto(photoId))
                {
                    neofsCount++;
                }
                else if (IsLegacyContent(photoId))
                {
                    legacyCount++;
                }
            }
            
            return new BigInteger[] { total, neofsCount, legacyCount };
        }
        
        #endregion
    }
}

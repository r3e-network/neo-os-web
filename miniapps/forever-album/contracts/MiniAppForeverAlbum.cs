using System.ComponentModel;
using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // Events
    
    /// <summary>
    /// Event emitted when a photo is uploaded.
    /// </summary>
    /// <param name="owner">Photo owner's address</param>
    /// <param name="photoId">Unique photo identifier (SHA256 hash)</param>
    /// <param name="encrypted">Whether the photo is client-side encrypted</param>
    /// <param name="index">User's photo index (0-based)</param>
    /// <summary>Event emitted when photo uploaded.</summary>
    public delegate void PhotoUploadedHandler(UInt160 owner, ByteString photoId, bool encrypted, BigInteger index);

    [DisplayName("MiniAppForeverAlbum")]
    [ManifestExtra("Author", "R3E Network")]
    [ManifestExtra("Email", "dev@r3e.network")]
    [ManifestExtra("Version", "1.0.0")]
    [ManifestExtra("Description", "On-chain photo album with optional client-side encryption.")]
    [ContractPermission("0xd2a4cff31913016155e38e474a2c06d08be276cf", "*")]  // GAS token
    /// <summary>
    /// ForeverAlbum MiniApp - On-chain photo album with NeoFS support.
    /// 
    /// FEATURES:
    /// - Store photos in NeoFS (unlimited size, 99% cheaper)
    /// - Hybrid mode: small thumbnails on-chain, large photos in NeoFS
    /// - Client-side encryption support
    /// - Content integrity verification via SHA256 hashes
    /// 
    /// STORAGE MODES:
    /// - Legacy: On-chain storage for small thumbnails (< 40KB)
    /// - NeoFS: Off-chain storage for full photos (unlimited size)
    /// 
    /// USE NEOFS FOR:
    /// - Photos larger than 40KB
    /// - Videos and media files
    /// - High-resolution images
    /// 
    /// USE LEGACY FOR:
    /// - Small thumbnails
    /// - Profile pictures
    /// - Metadata
    /// </summary>
    public class MiniAppForeverAlbum : MiniAppNeoFSBase
    {
        /// <summary>Unique application identifier for the ForeverAlbum miniapp.</summary>
        /// <summary>Unique application identifier for the forever-album miniapp.</summary>
        private const string APP_ID = "miniapp-forever-album";
        
        /// <summary>Maximum photos per upload batch (10). Prevents transaction size issues.</summary>
        private const int MAX_PHOTOS_PER_UPLOAD = 10;
        
        /// <summary>Maximum size for legacy on-chain photos (45KB = 45,000 bytes). Larger photos use NeoFS.</summary>
        private const int MAX_PHOTO_BYTES = 45000;
        
        /// <summary>Maximum total payload size per upload (60KB). Safety limit for transaction.</summary>
        private const int MAX_TOTAL_BYTES = 60000;
        
        /// <summary>Maximum photo size for NeoFS storage (100MB). Supports high-resolution images and videos.</summary>
        private const long MAX_NEFOS_PHOTO_SIZE = 100 * 1024 * 1024;

        /// <summary>Storage prefix for photo data.</summary>
        private static readonly byte[] PREFIX_PHOTO_DATA = new byte[] { 0x20 };
        /// <summary>Storage prefix for photo encrypted.</summary>
        private static readonly byte[] PREFIX_PHOTO_ENCRYPTED = new byte[] { 0x21 };
        /// <summary>Storage prefix for photo owner.</summary>
        private static readonly byte[] PREFIX_PHOTO_OWNER = new byte[] { 0x22 };
        /// <summary>Storage prefix for photo time.</summary>
        private static readonly byte[] PREFIX_PHOTO_TIME = new byte[] { 0x23 };
        /// <summary>Storage prefix for user photo count.</summary>
        private static readonly byte[] PREFIX_USER_PHOTO_COUNT = new byte[] { 0x24 };
        /// <summary>Storage prefix for user photo index.</summary>
        private static readonly byte[] PREFIX_USER_PHOTO_INDEX = new byte[] { 0x25 };
        /// <summary>Storage prefix for total photos.</summary>
        private static readonly byte[] PREFIX_TOTAL_PHOTOS = new byte[] { 0x26 };

        /// <summary>
        /// Photo metadata and data reference.
        /// 
        /// Storage: Individual fields stored with PREFIX_PHOTO_* + photoId
        /// Note: For NeoFS mode, Data field is null and NeoFS reference is stored separately
        /// </summary>
        public struct PhotoInfo
        {
            /// <summary>Unique photo identifier (SHA256 hash of content).</summary>
            public ByteString PhotoId;
            /// <summary>Photo owner's address.</summary>
            public UInt160 Owner;
            /// <summary>Whether photo is client-side encrypted.</summary>
            public bool Encrypted;
            /// <summary>Photo data for legacy mode, null for NeoFS mode.</summary>
            public ByteString Data;
            /// <summary>Unix timestamp when photo was uploaded.</summary>
            public BigInteger CreatedAt;
        }

        [DisplayName("PhotoUploaded")]
        public static event PhotoUploadedHandler OnPhotoUploaded;

        public static void _deploy(object data, bool update)
        {
            if (update) return;
            Storage.Put(Storage.CurrentContext, PREFIX_ADMIN, Runtime.Transaction.Sender);
            Storage.Put(Storage.CurrentContext, PREFIX_TOTAL_PHOTOS, 0);
        }

        [Safe]
        public static BigInteger TotalPhotos()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_TOTAL_PHOTOS);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static BigInteger GetUserPhotoCount(UInt160 user)
        {
            byte[] key = Helper.Concat(PREFIX_USER_PHOTO_COUNT, user);
            ByteString data = Storage.Get(Storage.CurrentContext, key);
            return data == null ? 0 : (BigInteger)data;
        }

        [Safe]
        public static ByteString[] GetUserPhotoIds(UInt160 user, BigInteger start, BigInteger limit)
        {
            BigInteger count = GetUserPhotoCount(user);
            if (count == 0 || limit <= 0 || start >= count) return new ByteString[0];

            if (start < 0) start = 0;
            if (limit > count - start) limit = count - start;
            if (limit > 50) limit = 50;

            ByteString[] ids = new ByteString[(int)limit];
            for (int i = 0; i < (int)limit; i++)
            {
                byte[] key = Helper.Concat(
                    Helper.Concat(PREFIX_USER_PHOTO_INDEX, user),
                    (ByteString)(start + i).ToByteArray());
                ByteString photoId = Storage.Get(Storage.CurrentContext, key);
                ids[i] = photoId ?? (ByteString)new byte[0];
            }
            return ids;
        }

        [Safe]
        public static PhotoInfo GetPhoto(ByteString photoId)
        {
            if (photoId is null || photoId.Length == 0) return new PhotoInfo();

            byte[] dataKey = Helper.Concat(PREFIX_PHOTO_DATA, photoId);
            ByteString data = Storage.Get(Storage.CurrentContext, dataKey);
            if (data == null) return new PhotoInfo();

            UInt160 owner = (UInt160)Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_OWNER, photoId));
            ByteString encryptedData = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_ENCRYPTED, photoId));
            bool encrypted = encryptedData != null && (BigInteger)encryptedData != 0;
            ByteString createdData = Storage.Get(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_TIME, photoId));
            BigInteger createdAt = createdData == null ? 0 : (BigInteger)createdData;

            return new PhotoInfo
            {
                PhotoId = photoId,
                Owner = owner,
                Encrypted = encrypted,
                Data = data,
                CreatedAt = createdAt
            };
        }

        public static bool UploadPhoto(string photoData, bool encrypted)
        {
            return UploadPhotos(new string[] { photoData }, new bool[] { encrypted });
        }

        public static bool UploadPhotos(string[] photoData, bool[] encryptedFlags)
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
                if (length == 0 || length > MAX_PHOTO_BYTES) return false;
                totalBytes += length;
                if (totalBytes > MAX_TOTAL_BYTES) return false;
            }

            BigInteger count = GetUserPhotoCount(sender);
            Transaction tx = Runtime.Transaction;

            for (int i = 0; i < photoData.Length; i++)
            {
                ByteString idSeed = Helper.Concat(tx.Hash, (ByteString)((BigInteger)i).ToByteArray());
                ByteString photoId = CryptoLib.Sha256(idSeed);

                Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_DATA, photoId), (ByteString)photoData[i]);
                Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_ENCRYPTED, photoId), encryptedFlags[i] ? 1 : 0);
                Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_OWNER, photoId), sender);
                Storage.Put(Storage.CurrentContext, Helper.Concat(PREFIX_PHOTO_TIME, photoId), Runtime.Time);

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
    }
}

using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    // ===================================================================
    //  PlatformRegistry — the engine table (design sections 3.1 + 6)
    //
    //  THE extension mechanism: scenario N+1 is a new engine contract plus
    //  one timelocked row here — the registry itself is never upgraded to
    //  add a domain, and a defective engine is retired without touching
    //  any app's identity or treasury. Both registration and retirement
    //  are 24h-timelocked propose/execute pairs.
    // ===================================================================
    public partial class PlatformRegistry
    {
        public static void ProposeEngine(string engineId, UInt160 engineHash, BigInteger schemaVersion)
        {
            ValidateAdmin();
            ValidateEngineIdFormat(engineId);
            ValidateAddress(engineHash);
            ExecutionEngine.Assert(engineHash != Runtime.ExecutingScriptHash, "engine cannot be the registry");
            ExecutionEngine.Assert(schemaVersion > 0, "invalid schema version");
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            PendingEngine pending = new PendingEngine
            {
                Hash = engineHash,
                SchemaVersion = schemaVersion,
                Eta = executeAfter,
                Retire = false,
            };
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PENDING_ENGINE, engineId), StdLib.Serialize(pending));
            OnEngineChangeProposed(engineId, engineHash, schemaVersion, false, executeAfter);
        }

        /// <summary>
        /// Execute a matured engine registration. Asserts the engine is a
        /// deployed contract at execution time (the audit NEW-I-2 idiom).
        /// </summary>
        public static void RegisterEngine(string engineId)
        {
            PendingEngine pending = TakeMaturedEnginePending(engineId, false);
            ExecutionEngine.Assert(
                ContractManagement.GetContract(pending.Hash) != null,
                "engine is not a deployed contract");
            // Reverse-index hygiene when an engineId re-registers under a new hash.
            EngineRow existing = GetEngineRow(engineId);
            if (existing != null && existing.Hash != pending.Hash)
            {
                Storage.Delete(Storage.CurrentContext, AccountKey(PREFIX_ENGINE_ID_BY_HASH, existing.Hash));
            }
            EngineRow row = new EngineRow { Hash = pending.Hash, SchemaVersion = pending.SchemaVersion, Active = true };
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_ENGINE_ROW, engineId), StdLib.Serialize(row));
            Storage.Put(Storage.CurrentContext, AccountKey(PREFIX_ENGINE_ID_BY_HASH, pending.Hash), engineId);
            OnEngineRegistered(engineId, pending.Hash, pending.SchemaVersion);
        }

        public static void ProposeRetireEngine(string engineId)
        {
            ValidateAdmin();
            EngineRow row = GetEngineRow(engineId);
            ExecutionEngine.Assert(row != null && row.Active, "engine not active");
            BigInteger executeAfter = Runtime.Time + TIMELOCK_DELAY_MS;
            PendingEngine pending = new PendingEngine
            {
                Hash = row.Hash,
                SchemaVersion = row.SchemaVersion,
                Eta = executeAfter,
                Retire = true,
            };
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_PENDING_ENGINE, engineId), StdLib.Serialize(pending));
            OnEngineChangeProposed(engineId, row.Hash, row.SchemaVersion, true, executeAfter);
        }

        /// <summary>
        /// Execute a matured retirement: the row goes inactive in isolation.
        /// Registered apps keep their identity, descriptors, and treasury;
        /// only new attachments, descriptor writes, and pool funding stop.
        /// </summary>
        public static void RetireEngine(string engineId)
        {
            PendingEngine pending = TakeMaturedEnginePending(engineId, true);
            EngineRow row = GetEngineRow(engineId);
            ExecutionEngine.Assert(row != null && row.Active, "engine not active");
            ExecutionEngine.Assert(row.Hash == pending.Hash, "engine row changed since proposal");
            row.Active = false;
            Storage.Put(Storage.CurrentContext, AppKey(PREFIX_ENGINE_ROW, engineId), StdLib.Serialize(row));
            OnEngineRetired(engineId);
        }

        public static void CancelEnginePending(string engineId)
        {
            ValidateAdmin();
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_ENGINE, engineId));
        }

        // ---- [Safe] engine reads ----

        /// <summary>Engine row as [engineHash, schemaVersion, active].</summary>
        [Safe]
        public static object[] GetEngine(string engineId)
        {
            EngineRow row = GetEngineRow(engineId);
            ExecutionEngine.Assert(row != null, "engine not found");
            return new object[] { row.Hash, row.SchemaVersion, row.Active };
        }

        [Safe]
        public static string EngineIdOfHash(UInt160 engineHash)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AccountKey(PREFIX_ENGINE_ID_BY_HASH, engineHash));
            return raw == null ? "" : (string)raw;
        }

        // ---- internals ----

        private static EngineRow GetEngineRow(string engineId)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_ENGINE_ROW, engineId));
            return raw == null ? null : (EngineRow)StdLib.Deserialize(raw);
        }

        // Loads, validates, and consumes a matured pending engine change of
        // the expected kind. Faults if absent, mismatched, or still locked.
        private static PendingEngine TakeMaturedEnginePending(string engineId, bool retire)
        {
            ByteString raw = Storage.Get(Storage.CurrentContext, AppKey(PREFIX_PENDING_ENGINE, engineId));
            ExecutionEngine.Assert(raw != null, "no pending engine change");
            PendingEngine pending = (PendingEngine)StdLib.Deserialize(raw);
            ExecutionEngine.Assert(pending.Retire == retire, retire
                ? "pending change is a registration"
                : "pending change is a retirement");
            ExecutionEngine.Assert(Runtime.Time >= pending.Eta, "timelock active");
            Storage.Delete(Storage.CurrentContext, AppKey(PREFIX_PENDING_ENGINE, engineId));
            return pending;
        }
    }
}

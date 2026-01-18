using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Profile Methods

        public static void UpdateDeveloperProfile(BigInteger devId, string field, string value)
        {
            ValidateAdmin();

            DeveloperData dev = GetDeveloper(devId);
            ExecutionEngine.Assert(dev.Wallet != UInt160.Zero, "dev not found");

            if (field == "bio")
            {
                ExecutionEngine.Assert(value.Length <= MAX_BIO_LENGTH, "bio too long");
                dev.Bio = value;
            }
            else if (field == "link")
            {
                ExecutionEngine.Assert(value.Length <= MAX_LINK_LENGTH, "link too long");
                dev.Link = value;
            }
            else if (field == "role")
            {
                ExecutionEngine.Assert(value.Length > 0 && value.Length <= 64, "invalid role");
                dev.Role = value;
            }
            else
            {
                ExecutionEngine.Assert(false, "invalid field");
            }

            StoreDeveloper(devId, dev);
            OnDeveloperUpdated(devId, field, value);
        }

        public static void DeactivateDeveloper(BigInteger devId)
        {
            ValidateAdmin();

            DeveloperData dev = GetDeveloper(devId);
            ExecutionEngine.Assert(dev.Wallet != UInt160.Zero, "dev not found");
            ExecutionEngine.Assert(dev.Active, "already inactive");

            dev.Active = false;
            StoreDeveloper(devId, dev);

            BigInteger activeDevs = ActiveDevelopers();
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_DEVS, activeDevs - 1);

            OnDeveloperDeactivated(devId, dev.Wallet);
        }

        #endregion
    }
}

using System.Numerics;
using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Native;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public partial class MiniAppDevTipping
    {
        #region Admin Methods

        public static BigInteger RegisterDeveloper(
            UInt160 wallet, string name, string role, string bio, string link)
        {
            ValidateAdmin();
            ValidateAddress(wallet);
            ExecutionEngine.Assert(name.Length > 0 && name.Length <= 64, "invalid name");
            ExecutionEngine.Assert(role.Length > 0 && role.Length <= 64, "invalid role");
            ExecutionEngine.Assert(bio.Length <= MAX_BIO_LENGTH, "bio too long");
            ExecutionEngine.Assert(link.Length <= MAX_LINK_LENGTH, "link too long");

            BigInteger devId = TotalDevelopers() + 1;
            Storage.Put(Storage.CurrentContext, PREFIX_DEV_ID, devId);

            DeveloperData dev = new DeveloperData
            {
                Wallet = wallet,
                Name = name,
                Role = role,
                Bio = bio,
                Link = link,
                Balance = 0,
                TotalReceived = 0,
                TipCount = 0,
                TipperCount = 0,
                WithdrawCount = 0,
                TotalWithdrawn = 0,
                RegisterTime = Runtime.Time,
                LastTipTime = 0,
                BadgeCount = 0,
                Active = true
            };
            StoreDeveloper(devId, dev);

            BigInteger activeDevs = ActiveDevelopers();
            Storage.Put(Storage.CurrentContext, PREFIX_ACTIVE_DEVS, activeDevs + 1);

            OnDeveloperRegistered(devId, wallet, name, role);
            return devId;
        }

        #endregion
    }
}

using System.ComponentModel;
using System.Numerics;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void NotificationHandler(
        string appId,
        string title,
        string content,
        string notificationType,
        BigInteger priority
    );

    public partial class MiniAppContract : SmartContract
    {
        [DisplayName("Platform_Notification")]
        public static event NotificationHandler OnNotification;

        protected static void EmitNotification(
            string appId,
            string title,
            string content,
            string notificationType = "Announcement",
            int priority = 0)
        {
            OnNotification(appId, title, content, notificationType, priority);
        }
    }
}

using System.ComponentModel;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Services;

namespace NeoMiniAppPlatform.Contracts
{
    public delegate void NotificationCompactHandler(
        string notificationType,
        string title,
        string content
    );

    public partial class MiniAppContract : SmartContract
    {
        // Compact event signature (no appId). Use only if manifest.contracts.<chain>.address is set.
        [DisplayName("Platform_Notification")]
        public static event NotificationCompactHandler OnNotificationCompact;

        protected static void EmitNotificationCompact(
            string notificationType,
            string title,
            string content)
        {
            OnNotificationCompact(notificationType, title, content);
        }
    }
}

import re

file_path = 'contracts/MiniAppBase/MiniAppBase.Core.cs'
with open(file_path, 'r') as f:
    content = f.read()

# Add PREFIX_AUTOMATION_ANCHOR and AutomationAnchor() to MiniAppBase.Core.cs
if 'PREFIX_AUTOMATION_ANCHOR' not in content:
    content = content.replace(
        'private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };',
        'private static readonly byte[] PREFIX_GATEWAY = new byte[] { 0x02 };\n        private static readonly byte[] PREFIX_AUTOMATION_ANCHOR = new byte[] { 0x07 };'
    )

if 'AutomationAnchor()' not in content:
    automation_methods = """
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR);
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, PREFIX_AUTOMATION_ANCHOR, anchor);
        }
"""
    content = content.replace(
        'public static void SetGateway(UInt160 gateway)',
        automation_methods + '\n        public static void SetGateway(UInt160 gateway)'
    )

with open(file_path, 'w') as f:
    f.write(content)


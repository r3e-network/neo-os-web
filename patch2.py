import re

file_path = 'contracts/MiniAppBase/MiniAppBase.Core.cs'
with open(file_path, 'r') as f:
    content = f.read()

automation_methods = """
        [Safe]
        public static UInt160 AutomationAnchor()
        {
            ByteString data = Storage.Get(Storage.CurrentContext, new byte[] { 0x07 });
            return data != null ? (UInt160)data : UInt160.Zero;
        }

        public static void SetAutomationAnchor(UInt160 anchor)
        {
            ValidateAdmin();
            ValidateAddress(anchor);
            Storage.Put(Storage.CurrentContext, new byte[] { 0x07 }, anchor);
        }
"""
if 'AutomationAnchor()' not in content:
    content = content.replace(
        'public static void SetGateway(UInt160 gateway)',
        automation_methods + '\n        public static void SetGateway(UInt160 gateway)'
    )

with open(file_path, 'w') as f:
    f.write(content)


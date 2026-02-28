import os
import re

contracts_dir = 'contracts'
automation_replacement = """
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

# Let's put this back into MiniAppBase.Core.cs and then fix the duplicate error by deleting from the new contracts
with open('contracts/MiniAppBase/MiniAppBase.Core.cs', 'r') as f:
    content = f.read()

if 'AutomationAnchor()' not in content:
    content = content.replace(
        'public static void SetGateway(UInt160 gateway)',
        automation_replacement + '\n        public static void SetGateway(UInt160 gateway)'
    )
    with open('contracts/MiniAppBase/MiniAppBase.Core.cs', 'w') as f:
        f.write(content)

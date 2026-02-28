import os
import re

contracts_dir = 'contracts'

def remove_automation_anchor(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We need to remove the definitions of AutomationAnchor() and SetAutomationAnchor()
    # It usually looks like:
    # public static UInt160 AutomationAnchor() { ... }
    # public static void SetAutomationAnchor(UInt160 anchor) { ... }
    # and maybe a PREFIX_AUTOMATION_ANCHOR definition.
    
    content = re.sub(r'public\s+static\s+UInt160\s+AutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}\s*', '', content)
    content = re.sub(r'public\s+static\s+void\s+SetAutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}\s*', '', content)
    # also remove any remaining [Safe] tags that were left above AutomationAnchor
    # we can use a more robust regex:
    
    # Or just simple string replacement if they are very standard.
    
    # Let's try matching the exact block
    
    pattern1 = r'(\[Safe\]\s*)?public\s+static\s+UInt160\s+AutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}'
    content = re.sub(pattern1, '', content)
    
    pattern2 = r'public\s+static\s+void\s+SetAutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}'
    content = re.sub(pattern2, '', content)
    
    pattern3 = r'private\s+static\s+readonly\s+byte\[\]\s+PREFIX_AUTOMATION_ANCHOR\s*=\s*new\s+byte\[\]\s*\{\s*0x[0-9a-fA-F]+\s*\};'
    content = re.sub(pattern3, '', content)
    
    pattern4 = r'private\s+static\s+readonly\s+byte\[\]\s+PREFIX_AUTOMATION_TASK\s*=\s*new\s+byte\[\]\s*\{\s*0x[0-9a-fA-F]+\s*\};'
    content = re.sub(pattern4, '', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

for root, _, files in os.walk(contracts_dir):
    for file in files:
        if file.endswith('.cs') and "MiniAppBase" not in root and "MiniAppTemplates" not in root:
            filepath = os.path.join(root, file)
            remove_automation_anchor(filepath)

print("Done")

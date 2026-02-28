import os
import re

for root, _, files in os.walk('contracts'):
    if "MiniAppBase" in root or "MiniAppTemplates" in root: continue
    for f in files:
        if f.endswith('.cs'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r') as file:
                content = file.read()
            
            # Replace class inheritance properly
            content = re.sub(
                r'public\s+(partial\s+)?class\s+MiniApp[A-Za-z0-9_]+\s*:\s*[A-Za-z0-9_]+',
                r'public partial class MiniAppContract : SmartContract',
                content
            )
            
            # Replace non-inheriting partials
            content = re.sub(
                r'public\s+partial\s+class\s+MiniApp[A-Za-z0-9_]+(?=[\s\{])',
                r'public partial class MiniAppContract',
                content
            )
            
            # Remove duplicated AutomationAnchor methods
            content = re.sub(r'(\[Safe\]\s*)?public\s+static\s+UInt160\s+AutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}', '', content)
            content = re.sub(r'public\s+static\s+void\s+SetAutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}', '', content)
            
            with open(filepath, 'w') as file:
                file.write(content)

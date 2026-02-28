import os
import re

for root, _, files in os.walk('contracts'):
    for f in files:
        if f.endswith('.cs'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r') as file:
                content = file.read()
            
            # Remove duplicated Neo usages
            content = re.sub(r'using Neo;\s*using Neo;', 'using Neo;', content)
            
            if 'UInt160' in content and 'using Neo;' not in content:
                content = "using Neo;\n" + content
                
            # For BadgeCheck, wait what's wrong? Ah, maybe we need Neo.SmartContract.Framework.UInt160? No, Neo.UInt160 usually works.
            # But the compiler says: The type or namespace name 'UInt160' could not be found (are you missing a using directive or an assembly reference?)
            
            with open(filepath, 'w') as file:
                file.write(content)

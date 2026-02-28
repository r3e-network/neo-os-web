import os
import re

for root, _, files in os.walk('contracts'):
    for f in files:
        if f.endswith('.cs'):
            filepath = os.path.join(root, f)
            with open(filepath, 'r') as file:
                content = file.read()
            
            if 'UInt160' in content and 'using Neo;' not in content:
                content = "using Neo;\n" + content
                with open(filepath, 'w') as file:
                    file.write(content)

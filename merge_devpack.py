import os
import re

devpack_dir = 'contracts/MiniApp.DevPack'
base_dir = 'contracts/MiniAppBase'

cs_files = [
    'MiniAppBase.cs',
    'MiniAppComputeBase.cs',
    'MiniAppGameBase.cs',
    'MiniAppGameComputeBase.cs',
    'MiniAppServiceBase.cs',
    'MiniAppTimeLockBase.cs',
    'ServiceInterfaces.cs'
]

combined_code = []
usings = set()

for f in cs_files:
    path = os.path.join(devpack_dir, f)
    if not os.path.exists(path): continue
    
    with open(path, 'r') as file:
        content = file.read()
        
    using_matches = re.findall(r'^using\s+[\w\.]+;', content, re.MULTILINE)
    usings.update(using_matches)
    
    namespace_match = re.search(r'namespace\s+NeoMiniAppPlatform\.Contracts\s*\{([\s\S]*)\}', content)
    if namespace_match:
        inner = namespace_match.group(1)
        # We replace ALL public abstract class, public class, etc with public partial class MiniAppContract
        inner = re.sub(r'public\s+(abstract\s+)?class\s+(MiniAppBase|MiniAppComputeBase|MiniAppGameBase|MiniAppGameComputeBase|MiniAppServiceBase|MiniAppTimeLockBase)(\s*:\s*[a-zA-Z0-9_]+)?', r'public partial class MiniAppContract', inner)
        
        # Remove empty constructors which might clash
        inner = re.sub(r'protected\s+(MiniAppBase|MiniAppComputeBase|MiniAppGameBase|MiniAppGameComputeBase|MiniAppServiceBase|MiniAppTimeLockBase)\s*\([^)]*\)\s*\{[^}]*\}', '', inner)
        
        # We need to remove the duplicate `public static UInt160 Admin()` that is already in MiniAppBase.Core.cs
        # Actually, it's safer to just comment them out if they are standard MiniAppBase methods
        
        combined_code.append(f"// From {f}\n" + inner.strip())

output_path = os.path.join(base_dir, "MiniAppGameCompute.Legacy.cs")
with open(output_path, 'w') as out:
    for u in sorted(list(usings)):
        out.write(u + "\n")
    out.write("\nnamespace NeoMiniAppPlatform.Contracts\n{\n")
    out.write("\n\n".join(combined_code))
    out.write("\n}\n")
    
print("Merged DevPack into MiniAppGameCompute.Legacy.cs")

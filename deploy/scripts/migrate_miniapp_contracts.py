import os
import re
import shutil

miniapps_dir = 'miniapps'
contracts_dir = 'contracts'

if not os.path.exists(contracts_dir):
    os.makedirs(contracts_dir)

for app_name in os.listdir(miniapps_dir):
    app_path = os.path.join(miniapps_dir, app_name)
    app_contracts_dir = os.path.join(app_path, 'contracts')
    
    if not os.path.isdir(app_contracts_dir):
        continue
        
    # Convert kebab-case to PascalCase (e.g. fogplay -> CoinFlip)
    pascal_name = "".join(word.title() for word in app_name.split("-"))
    target_contract_name = f"MiniApp{pascal_name}"
    target_dir = os.path.join(contracts_dir, target_contract_name)
    
    # Don't overwrite existing ones if they already are in master format?
    # Actually, we should check if they exist.
    if os.path.exists(target_dir):
        print(f"Skipping {app_name} as {target_dir} already exists.")
        continue
        
    print(f"Migrating {app_name} to {target_dir}")
    os.makedirs(target_dir)
    
    # Read all .cs files
    cs_files = [f for f in os.listdir(app_contracts_dir) if f.endswith('.cs')]
    if not cs_files:
        continue
        
    combined_cs_path = os.path.join(target_dir, f"{target_contract_name}.cs")
    
    usings = set()
    namespaces = set()
    code_blocks = []
    
    for f in sorted(cs_files):
        with open(os.path.join(app_contracts_dir, f), 'r') as file:
            content = file.read()
            
            # Extract usings
            using_matches = re.findall(r'^using\s+[\w\.]+;', content, re.MULTILINE)
            usings.update(using_matches)
            
            # Extract namespace content
            namespace_match = re.search(r'namespace\s+NeoMiniAppPlatform\.Contracts\s*\{([\s\S]*)\}', content)
            if namespace_match:
                inner_content = namespace_match.group(1)
                
                # Replace class declaration
                inner_content = re.sub(
                    r'public\s+partial\s+class\s+MiniApp[A-Za-z0-9_]+\s*:\s*(?:MiniAppGameComputeBase|MiniAppBase|SmartContract)', 
                    r'public partial class MiniAppContract : SmartContract', 
                    inner_content
                )
                
                # If there are any partial classes inside the namespace that are just "public partial class MiniApp...", replace them too
                inner_content = re.sub(
                    r'public\s+partial\s+class\s+MiniApp[A-Za-z0-9_]+(\s*)$', 
                    r'public partial class MiniAppContract\1', 
                    inner_content, flags=re.MULTILINE
                )
                
                code_blocks.append(f"    // From {f}\n" + inner_content.strip())
    
    # Write combined file
    with open(combined_cs_path, 'w') as out:
        for u in sorted(list(usings)):
            out.write(f"{u}\n")
        
        out.write("\nnamespace NeoMiniAppPlatform.Contracts\n{\n")
        out.write("\n\n".join(code_blocks))
        out.write("\n}\n")
        
    # Create simple .csproj
    with open(os.path.join(target_dir, f"{target_contract_name}.csproj"), 'w') as out:
        out.write(f"""<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Neo.SmartContract.Framework" Version="3.7.4" />
  </ItemGroup>
</Project>
""")

print("Done.")

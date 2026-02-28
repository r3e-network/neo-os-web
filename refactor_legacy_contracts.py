import os
import re

contracts_dir = 'contracts'

for dir_name in os.listdir(contracts_dir):
    dir_path = os.path.join(contracts_dir, dir_name)
    if not os.path.isdir(dir_path) or not dir_name.startswith("MiniApp"):
        continue
    
    if dir_name in ["MiniAppBase", "MiniAppTemplates"]:
        continue
        
    # We will refactor all .cs files in this directory
    cs_files = [f for f in os.listdir(dir_path) if f.endswith('.cs')]
    
    is_refactored = False
    
    # Check if already refactored
    for f in cs_files:
        with open(os.path.join(dir_path, f), 'r') as file:
            if "public partial class MiniAppContract" in file.read():
                is_refactored = True
                break
                
    if is_refactored:
        continue
        
    print(f"Refactoring {dir_name}...")
    
    for f in cs_files:
        file_path = os.path.join(dir_path, f)
        with open(file_path, 'r') as file:
            content = file.read()
            
        # Replace class inheritance and class name
        # public class MiniAppName : SmartContract
        # public partial class MiniAppName : MiniAppGameComputeBase
        content = re.sub(
            r'public\s+(?:partial\s+)?class\s+MiniApp[A-Za-z0-9_]+\s*:\s*[A-Za-z0-9_]+',
            r'public partial class MiniAppContract : SmartContract',
            content
        )
        
        # Replace non-inheriting partials
        # public partial class MiniAppName
        content = re.sub(
            r'public\s+partial\s+class\s+MiniApp[A-Za-z0-9_]+(?=[\s\{])',
            r'public partial class MiniAppContract',
            content
        )
        
        # Remove AutomationAnchor logic
        content = re.sub(r'(\[Safe\]\s*)?public\s+static\s+UInt160\s+AutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}', '', content)
        content = re.sub(r'public\s+static\s+void\s+SetAutomationAnchor\s*\([^)]*\)\s*\{[^}]*\}', '', content)
        content = re.sub(r'private\s+static\s+readonly\s+byte\[\]\s+PREFIX_AUTOMATION_ANCHOR\s*=\s*new\s+byte\[\]\s*\{\s*0x[0-9a-fA-F]+\s*\};', '', content)
        content = re.sub(r'private\s+static\s+readonly\s+byte\[\]\s+PREFIX_AUTOMATION_TASK\s*=\s*new\s+byte\[\]\s*\{\s*0x[0-9a-fA-F]+\s*\};', '', content)
        
        with open(file_path, 'w') as file:
            file.write(content)

    # Ensure csproj exists and has MiniAppBase reference
    csproj_path = os.path.join(dir_path, f"{dir_name}.csproj")
    csproj_content = f"""<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="..\\MiniAppBase\\*.cs" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Neo.SmartContract.Framework" Version="3.7.4" />
  </ItemGroup>
</Project>
"""
    with open(csproj_path, 'w') as file:
        file.write(csproj_content)
        
print("Refactoring done.")

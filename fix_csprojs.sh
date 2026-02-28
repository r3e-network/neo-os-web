#!/bin/bash

cd contracts

for d in MiniApp*; do
  if [ ! -d "$d" ]; then continue; fi
  if [ "$d" == "MiniAppBase" ] || [ "$d" == "MiniApp.DevPack" ] || [ "$d" == "MiniAppTemplates" ]; then continue; fi
  
  # Delete existing to recreate correctly
  rm -f "$d/$d.csproj"
  
  echo "Creating csproj for $d"
  
  # Check if it uses DevPack or MiniAppBase
  if grep -q ": *MiniApp" "$d"/*.cs; then
      REF="MiniApp.DevPack"
  else
      REF="MiniAppBase"
  fi
  
  cat << CS_EOF > "$d/$d.csproj"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="..\\$REF\\*.cs" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Neo.SmartContract.Framework" Version="3.7.4" />
  </ItemGroup>
</Project>
CS_EOF

done

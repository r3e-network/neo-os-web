for d in contracts/MiniApp*; do
  if [ -f "$d/$(basename $d).csproj" ]; then
    if ! grep -q "MiniAppBase" "$d/$(basename $d).csproj"; then
      sed -i '/<ItemGroup>/i \  <ItemGroup>\n    <Compile Include="..\/MiniAppBase\/*.cs" />\n  </ItemGroup>' "$d/$(basename $d).csproj"
    fi
  fi
done

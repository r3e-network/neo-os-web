const fs = require('fs');
let code = fs.readFileSync('contracts/build.sh', 'utf8');

// The new build.sh just needs to build what exists now.
const newCode = `#!/bin/bash
set -e

# Make sure we're in the contracts directory
cd "$(dirname "$0")"

mkdir -p build

echo "=== Building Platform Base Contracts ==="

dotnet build MiniAppBase/MiniAppBase.csproj -c Release
dotnet build MiniAppTemplates/MiniAppTemplates.csproj -c Release
dotnet build MiniAppFactoryV2/MiniAppFactoryV2.csproj -c Release
dotnet build AppRegistry/AppRegistry.csproj -c Release
dotnet build ServiceLayerGateway/ServiceLayerGateway.csproj -c Release
dotnet build PaymentHub/PaymentHub.csproj -c Release
dotnet build AutomationAnchor/AutomationAnchor.csproj -c Release

echo "=== Build Complete ==="
ls -lh build
`;

fs.writeFileSync('contracts/build.sh', newCode);

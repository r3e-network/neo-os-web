#!/bin/bash
# Generate manifest.yaml for all service packages

SERVICES=(
    "functions:Functions Service:Serverless function execution service:500"
    "vrf:VRF Service:Verifiable Random Function service:100"
    "oracle:Oracle Service:Decentralized oracle data feeds:200"
    "triggers:Triggers Service:Event-driven trigger management:150"
    "gasbank:Gas Bank Service:Gas fee management and sponsorship:50"
    "automation:Automation Service:Automated task scheduling and execution:300"
    "pricefeed:Price Feed Service:Real-time price data aggregation:100"
    "datafeeds:Data Feeds Service:Generic data feed subscriptions:200"
    "datastreams:Data Streams Service:Real-time data streaming:150"
    "datalink:Data Link Service:Cross-chain data linking:100"
    "dta:DTA Service:Decentralized Token Automation:100"
    "confidential:Confidential Service:Confidential computing and privacy:50"
    "cre:CRE Service:Contract Runtime Environment:500"
    "ccip:CCIP Service:Cross-Chain Interoperability Protocol:200"
    "secrets:Secrets Service:Secret management and key rotation:50"
    "random:Random Service:Cryptographically secure random number generation:20"
)

for entry in "${SERVICES[@]}"; do
    IFS=':' read -r name display desc storage <<< "$entry"
    package_id="com.r3e.services.$name"
    dir="packages/$package_id"

    if [ ! -d "$dir" ]; then
        echo "Skipping $name (directory not found)"
        continue
    fi

    cat > "$dir/manifest.yaml" <<EOF
package_id: $package_id
version: "1.0.0"
display_name: "$display"
description: "$desc"
author: "R3E Network"
license: "MIT"

services:
  - name: $name
    domain: $name
    description: "$desc"
    capabilities:
      - ${name}.execute
      - ${name}.query
    layer: service

permissions:
  - name: system.api.storage
    description: "Required for data persistence"
    required: true
  - name: system.api.bus
    description: "Required for event publishing"
    required: false

resources:
  max_storage_bytes: $((storage * 1024 * 1024))  # ${storage} MB
  max_concurrent_requests: 1000
  max_requests_per_second: 5000
  max_events_per_second: 1000

dependencies:
  - module: store
    required: true

metadata:
  category: "service"
  tags:
    - $name
EOF

    echo "✓ Generated manifest for $name"
done

echo ""
echo "Manifest generation complete!"

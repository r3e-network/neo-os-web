#!/bin/bash
find services/ -type f -name "*.go" -exec sed -i '' 's/neo.org/r3e.network/g' {} +
find cmd/ -type f -name "*.go" -exec sed -i '' 's/neo.org/r3e.network/g' {} +

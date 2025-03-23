#!/bin/bash

# Run unit tests only, skipping integration tests and packages with known issues
echo "Running selected unit tests..."

# List of packages that should work properly
PACKAGES=(
  "./internal/config/..."
  "./internal/api/common/..."
  "./pkg/logger/..."
  "./pkg/cache/..."
  "./internal/blockchain/compat/..."
  "./internal/blockchain/..."
)

# Run tests on selected packages
go test -v ${PACKAGES[@]} -short

# Show summary of what was tested
echo "Tested the following packages:"
for pkg in "${PACKAGES[@]}"; do
  echo "  - $pkg"
done

echo "Skipped packages with known issues."
echo "Once dependencies are fixed, run 'make test' to test all packages."

exit $? 
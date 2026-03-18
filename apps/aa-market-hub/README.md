# AA Market Hub

Read AA address market listings from an on-chain market contract.

## What It Does

- accepts a market contract hash
- reads `getListingCount`
- reads `getListing(id)` for each listing

This first version is intentionally read-only and optimized for inspection.

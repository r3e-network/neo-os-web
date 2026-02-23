#!/bin/bash
find platform/edge/ -type f -name "*.ts" -exec sed -i '' 's/neohub_account_id/user_id/g' {} +
find platform/edge/ -type f -name "*.ts" -exec sed -i '' 's/neohub_accounts/users/g' {} +
find platform/edge/ -type f -name "*.ts" -exec sed -i '' 's/linked_neo_accounts/user_wallets/g' {} +
find platform/edge/ -type f -name "*.ts" -exec sed -i '' 's/address/address/g' {} + # just placeholder

# Generated wallets (local dev)
This directory is created and populated by `deploy/scripts/setup_neoexpress.sh`.

It is intentionally ignored by git because it may contain wallet key material.

Expected files (used by `fairy.toml` and local tooling):

- `deploy/wallets/owner.json`
- `deploy/wallets/tee.json`
- `deploy/wallets/user.json`

To generate them:

```bash
./deploy/scripts/setup_neoexpress.sh
```

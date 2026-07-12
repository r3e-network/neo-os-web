# Soulbound Certificate

Non-transferable NEP-11 certificates for courses, events, and achievements.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-soulbound-certificate` |
| **Category** | nft |
| **Version** | 1.2.0 |
| **Framework** | Host-native React playarea |


## How It Works

1. **Create Template**: Issuers create certificate templates with custom fields
2. **Refine Template**: Issuers can update the design and supply cap without changing its template ID
3. **Issue Certificate**: Mint soulbound certificates for recipients
4. **Recipient Record**: Recipients can view the non-transferable records held by their wallet
5. **Verification**: Anyone can verify certificate authenticity before connecting a wallet
6. **Non-Transferable**: Soulbound tokens cannot be transferred

The certificate shown while composing is always labelled **Preview / Draft**.
Only a canonical-network contract read that matches the requested token,
NEP-11 owner, and template can produce a green **Valid** state. Broadcast writes
remain pending until their exact event and full state readback agree. Before a
wallet signature, the app also proves that its recovery receipt can survive a
reload; if that storage is unavailable, wallet writes stay disabled.
## Features

- Create certificate templates with supply limits
- Update existing credential designs while preserving issued records
- Issue soulbound certificates to recipients
- Display certificates with QR verification
- Issuers can revoke certificates

## User Flow

1. **Create template**: define certificate name, issuer, category, and supply.
2. **Manage template**: edit metadata, supply, or active state from the secondary template drawer.
3. **Issue certificate**: send certificate to recipient address.
4. **View certificate**: recipient opens "My Certificates" with a portable QR verification link.
5. **Verify / revoke**: any visitor can verify by token ID; the issuer can revoke if needed.

## Usage

### Getting Started

1. **Open the App**: Open Soulbound Certificate from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet
3. **Explore**: Verify a shared certificate before connecting, or connect to manage issuer templates
4. **Manage**: Issue, view, or verify certificates

### Creating Certificate Templates

1. **Define Template**:
   | Field | Description |
   |-------|-------------|
   | Name | Certificate title |
   | Issuer | Your organization name |
   | Category | Course, event, achievement, etc. |
   | Max Supply | Total certificates available |
   | Description | Detailed certificate description |

2. **Set Limits**:
   - Choose a positive maximum supply up to 100,000
   - Limited certificates are more exclusive
   - Consider supply when setting limits

3. **Create Template**:
   - Template published on-chain
   - Becomes available for issuing
   - Supply tracked automatically

4. **Update Template**:
   - Open Details → Your Templates → Edit
   - Change the credential design or raise/lower supply without going below the issued count
   - The update remains pending until `TemplateUpdated` and the full metadata readback agree

### Issuing Certificates

1. **Select Template**:
   - Choose from your created templates
   - Check remaining supply
   - Review template details

2. **Enter Details**:
   | Field | Description |
   |-------|-------------|
   | Recipient | Wallet address of recipient |
   | Recipient Name | Display name on certificate |
   | Achievement | What they accomplished |
   | Memo | Additional notes (optional) |

3. **Issue Certificate**:
   - Certificate minted as NFT
   - Sent to recipient's wallet
   - Issued count increments against the fixed supply cap

### Receiving Certificates

1. **View My Certificates**:
   - Open the app with your wallet
   - See all certificates you hold
   - Each has a unique QR verification link

2. **Certificate Details**:
   - Issuer name and organization
   - Achievement description
   - Issue date
   - Unique token ID

3. **Share or Prove**:
   - Show QR code for verification
   - Share certificate link
   - Copy or share the portable verification link

### Verifying Certificates

1. **By Recipient**:
   - Recipient shows their QR code
   - Scan to verify authenticity
   - View on-chain details

2. **By Token ID**:
   - Enter token ID in verify section
   - View full certificate details
   - Confirm issuer and validity

### Revoking Certificates

**Issuer Actions:**

1. **Find Certificate**:
   - Locate token ID to revoke
   - Verify reason for revocation

2. **Revoke**:
   - Click revoke on certificate
   - Certificate remains in the holder wallet and is marked revoked on-chain
   - The revoked token ID is never reused; later verification resolves to `revoked`

**Reasons for Revocation:**
- Incorrect issuance
- Policy violation
- Fraudulent certificate
- Achievement invalidated

### Soulbound Features

- **Non-Transferable**: Cannot be sold or given away
- **Permanent**: Stays in recipient's wallet forever
- **Verifiable**: Anyone can verify authenticity
- **Revocable**: Issuer can revoke if needed

### Best Practices

**For Issuers:**
- Use consistent naming conventions
- Set realistic supply limits
- Document each issuance
- Revoke only when necessary

**For Recipients:**
- Keep wallet secure
- Back up wallet credentials
- Display certificates proudly
- Share achievements responsibly

### FAQ

**Can certificates be transferred?**
No, soulbound means permanently attached.

**Can I change a certificate?**
No, certificates are immutable once issued.

**What happens if issuer revokes?**
The certificate stays as an auditable record but its on-chain status becomes revoked.

**Is there a cost to issue?**
Yes, standard minting fees apply.

**How do recipients view certificates?**
Open the app with connected wallet.

### Troubleshooting

**Cannot create template:**
- Check GAS balance
- Verify template parameters
- Refresh and try again

**Issue failing:**
- Verify recipient address
- Check supply availability
- Ensure wallet connection

**Verification failed:**
- Check token ID accuracy
- Verify network matches
- Confirm issuer address

### Support

For certificate questions, review the contract methods.

For technical issues, contact the Neo MiniApp team.

## Contract Methods

- `CreateTemplate(issuer, name, issuerName, category, maxSupply, description)`
- `UpdateTemplate(issuer, templateId, name, issuerName, category, maxSupply, description)`
- `IssueCertificate(issuer, recipient, templateId, recipientName, achievement, memo)`
- `RevokeCertificate(issuer, tokenId)`
- `Transfer(to, tokenId, data)` (always aborts because certificates are soulbound)
- `GetTemplateDetails(templateId)`
- `GetCertificateDetails(tokenId)`

## Permissions

| Permission | Required |
|------------|----------|
| Payments | ❌ No |
| Automation | ❌ No |
| RNG | ❌ No |
| Data Feed | ❌ No |

## Network Configuration

### Testnet

| Property | Value |
|----------|-------|
| **Contract** | `0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b` |
| **RPC** | `https://api.n3index.dev/testnet` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b) |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b` |
| **RPC** | `https://api.n3index.dev/mainnet` |
| **Explorer** | [View on Neo3Scan](https://www.neo3scan.com/contract/0x4e920c7fbc602161dd2c054eca3a0eec6df5eb6b) |

> Contract existence and the deployed MainNet/TestNet workflow ABIs were rechecked on 2026-07-12.
> The local build contains newer base credit-recovery methods, but this UI does not call or depend on them.
> This frontend-polish pass did not submit a new write transaction. See
> [TESTNET_STATUS.md](./TESTNET_STATUS.md) for the trust boundary and remaining
> funded end-to-end validation.

Production handoff references:

- [PRODUCTION_STATUS.md](./PRODUCTION_STATUS.md)
- [NETWORK_STATUS.md](./NETWORK_STATUS.md)
- [ASSET_PROVENANCE.md](./ASSET_PROVENANCE.md)

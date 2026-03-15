# Soulbound Certificate

Non-transferable NEP-11 certificates for courses, events, and achievements.

## Overview

| Property | Value |
|----------|-------|
| **App ID** | `miniapp-soulbound-certificate` |
| **Category** | utility |
| **Version** | 1.0.0 |
| **Framework** | Vue 3 (uni-app) |


## How It Works

1. **Create Template**: Issuers create certificate templates with custom fields
2. **Issue Certificate**: Mint soulbound certificates for recipients
3. **Recipient Control**: Recipients control their own certificates
4. **Verification**: Third parties can verify certificate authenticity
5. **Non-Transferable**: Soulbound tokens cannot be transferred
## Features

- Create certificate templates with supply limits
- Issue soulbound certificates to recipients
- Display certificates with QR verification
- Issuers can revoke certificates

## User Flow

1. **Create template**: define certificate name, issuer, category, and supply.
2. **Issue certificate**: send certificate to recipient address.
3. **View certificate**: recipient opens "My Certificates" with QR token ID.
4. **Verify / revoke**: issuer checks token ID and revokes if needed.

## Usage

### Getting Started

1. **Launch the App**: Open Soulbound Certificate from your Neo MiniApp dashboard
2. **Connect Wallet**: Connect your Neo N3 wallet
3. **Explore**: Browse certificates or create your own
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
   - Choose maximum supply (can be limited or unlimited)
   - Limited certificates are more exclusive
   - Consider supply when setting limits

3. **Create Template**:
   - Template published on-chain
   - Becomes available for issuing
   - Supply tracked automatically

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
   - Supply count decremented

### Receiving Certificates

1. **View My Certificates**:
   - Open the app with your wallet
   - See all certificates you hold
   - Each has unique QR code

2. **Certificate Details**:
   - Issuer name and organization
   - Achievement description
   - Issue date
   - Unique token ID

3. **Share or Prove**:
   - Show QR code for verification
   - Share certificate link
   - Export details as needed

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
   - Certificate burned from wallet
   - Cannot be re-issued

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
Certificate is burned and no longer exists.

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
- `Transfer(from, to, tokenId, data)`
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
| **Contract** | `Not deployed` |
| **RPC** | `https://testnet1.neo.coz.io:443` |
| **Explorer** | `https://testnet.neotube.io` |

### Mainnet

| Property | Value |
|----------|-------|
| **Contract** | `Not deployed` |
| **RPC** | `https://mainnet1.neo.coz.io:443` |
| **Explorer** | `https://neotube.io` |

> Contract deployment is pending; `neo-manifest.json` keeps empty addresses until deployment.

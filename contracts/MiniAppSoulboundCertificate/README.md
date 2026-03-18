# MiniAppSoulboundCertificate | Soulbound Certificate

Soulbound Certificate issues non-transferable NEP-11 badges for courses, events, or achievements.
Issuers create templates and mint certificates to recipients.

## Features
- Create certificate templates with supply limits
- Issue soulbound certificates to recipients
- Certificates are non-transferable
- Issuers can revoke certificates

## Core Methods

### `CreateTemplate`
Creates a new certificate template.

```
CreateTemplate(
  UInt160 issuer,
  string name,
  string issuerName,
  string category,
  BigInteger maxSupply,
  string description
)
```

### `IssueCertificate`
Issues a certificate. Token IDs are formatted as `templateId-serial`.

```
IssueCertificate(UInt160 issuer, UInt160 recipient, BigInteger templateId, string recipientName, string achievement, string memo)
```

### `RevokeCertificate`
Revokes a certificate (issuer-only).

```
RevokeCertificate(UInt160 issuer, ByteString tokenId)
```

### `Transfer`
NEP-11 transfer (always fails unless `from == to`).

```
Transfer(UInt160 from, UInt160 to, ByteString tokenId, object data)
```

## Read Methods
- `GetTemplateDetails(templateId)`
- `GetCertificateDetails(tokenId)`
- `GetIssuerTemplates(issuer, offset, limit)`
- `tokens`, `tokensOf`, `properties` (NEP-11)

## Notes
- Uses `MiniAppBase` update method for upgrades.
- Certificates are soulbound and cannot be transferred.

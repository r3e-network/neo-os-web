export interface TemplateItem {
  id: string;
  issuer: string;
  name: string;
  issuerName: string;
  category: string;
  maxSupply: bigint;
  issued: bigint;
  description: string;
  active: boolean;
}

export interface CertificateItem {
  tokenId: string;
  templateId: string;
  owner: string;
  templateName: string;
  issuerName: string;
  category: string;
  description: string;
  recipientName: string;
  achievement: string;
  memo: string;
  issuedTime: number;
  revoked: boolean;
  revokedTime: number;
}

import { ref, reactive } from "vue";
import QRCode from "qrcode";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";

interface TemplateItem {
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

interface CertificateItem {
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

export function useCertificates() {
  const { t } = useI18n();
  const { address, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;

  const contractAddress = ref<string | null>(null);
  const templates = ref<TemplateItem[]>([]);
  const certificates = ref<CertificateItem[]>([]);
  const certQrs = reactive<Record<string, string>>({});

  const parseBigInt = (value: unknown) => {
    try {
      return BigInt(String(value ?? "0"));
    } catch {
      return 0n;
    }
  };

  const parseBool = (value: unknown) => value === true || value === "true" || value === 1 || value === "1";

  const encodeTokenId = (tokenId: string) => {
    try {
      const bytes = new TextEncoder().encode(tokenId);
      return btoa(String.fromCharCode(...bytes));
    } catch {
      return tokenId;
    }
  };

  const parseTemplate = (raw: any, id: string): TemplateItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      id,
      issuer: String(raw.issuer || ""),
      name: String(raw.name || ""),
      issuerName: String(raw.issuerName || ""),
      category: String(raw.category || ""),
      maxSupply: parseBigInt(raw.maxSupply),
      issued: parseBigInt(raw.issued),
      description: String(raw.description || ""),
      active: parseBool(raw.active),
    };
  };

  const parseCertificate = (raw: any, tokenId: string): CertificateItem | null => {
    if (!raw || typeof raw !== "object") return null;
    return {
      tokenId,
      templateId: String(raw.templateId || ""),
      owner: String(raw.owner || ""),
      templateName: String(raw.templateName || ""),
      issuerName: String(raw.issuerName || ""),
      category: String(raw.category || ""),
      description: String(raw.description || ""),
      recipientName: String(raw.recipientName || ""),
      achievement: String(raw.achievement || ""),
      memo: String(raw.memo || ""),
      issuedTime: Number.parseInt(String(raw.issuedTime || "0"), 10) || 0,
      revoked: parseBool(raw.revoked),
      revokedTime: Number.parseInt(String(raw.revokedTime || "0"), 10) || 0,
    };
  };

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, t)) {
      throw new Error(t("wrongChain"));
    }
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) {
      throw new Error(t("contractMissing"));
    }
    return contractAddress.value;
  };

  const fetchTemplateIds = async (issuerAddress: string) => {
    const contract = await ensureContractAddress();
    const result = await invokeRead({
      contractAddress: contract,
      operation: "GetIssuerTemplates",
      args: [
        { type: "Hash160", value: issuerAddress },
        { type: "Integer", value: "0" },
        { type: "Integer", value: "20" },
      ],
    });
    const parsed = parseInvokeResult(result);
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed
      .map((value) => String(value || ""))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0)
      .map((value) => String(value));
  };

  const fetchTemplateDetails = async (templateId: string) => {
    const contract = await ensureContractAddress();
    const details = await invokeRead({
      contractAddress: contract,
      operation: "GetTemplateDetails",
      args: [{ type: "Integer", value: templateId }],
    });
    const parsed = parseInvokeResult(details) as any;
    return parseTemplate(parsed, templateId);
  };

  const refreshTemplates = async () => {
    if (!address.value) return;
    try {
      const ids = await fetchTemplateIds(address.value);
      const details = await Promise.all(ids.map(fetchTemplateDetails));
      templates.value = details.filter(Boolean) as TemplateItem[];
    } catch {
      templates.value = [];
    }
  };

  const refreshCertificates = async () => {
    if (!address.value) return;
    try {
      const contract = await ensureContractAddress();
      const tokenResult = await invokeRead({
        contractAddress: contract,
        operation: "TokensOf",
        args: [{ type: "Hash160", value: address.value }],
      });
      const parsed = parseInvokeResult(tokenResult);
      if (!Array.isArray(parsed)) {
        certificates.value = [];
        return;
      }
      const tokenIds = parsed.map((value) => String(value || "")).filter(Boolean);

      const details = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const detailResult = await invokeRead({
            contractAddress: contract,
            operation: "GetCertificateDetails",
            args: [{ type: "ByteArray", value: encodeTokenId(tokenId) }],
          });
          const detailParsed = parseInvokeResult(detailResult) as any;
          return parseCertificate(detailParsed, tokenId);
        }),
      );

      certificates.value = details.filter(Boolean) as CertificateItem[];
      await Promise.all(
        certificates.value.map(async (cert) => {
          if (!certQrs[cert.tokenId]) {
            try {
              certQrs[cert.tokenId] = await QRCode.toDataURL(cert.tokenId, { margin: 1 });
            } catch {}
          }
        }),
      );
    } catch {
      certificates.value = [];
    }
  };

  return {
    templates,
    certificates,
    certQrs,
    refreshTemplates,
    refreshCertificates,
    ensureContractAddress,
    parseBigInt,
    parseBool,
    encodeTokenId,
  };
}

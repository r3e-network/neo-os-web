import { ref, reactive } from "vue";
import QRCode from "qrcode";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { messages } from "@/locale/messages";
import { parseInvokeResult } from "@shared/utils/neo";
import type { TemplateItem, CertificateItem } from "@/types";

export function useCertificates() {
  const { t } = createUseI18n(messages)();
  const { address, invokeContract, invokeRead } = useWallet() as WalletSDK;
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? t("contractMissing") : t(key),
  );

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

  const parseTemplate = (raw: Record<string, unknown>, id: string): TemplateItem | null => {
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

  const parseCertificate = (raw: Record<string, unknown>, tokenId: string): CertificateItem | null => {
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

  const fetchTemplateIds = async (issuerAddress: string) => {
    const contract = await ensureContractAddress();
    const result = await invokeRead({
      scriptHash: contract,
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
      scriptHash: contract,
      operation: "GetTemplateDetails",
      args: [{ type: "Integer", value: templateId }],
    });
    const parsed = parseInvokeResult(details);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parseTemplate(parsed as Record<string, unknown>, templateId);
  };

  const refreshTemplates = async () => {
    if (!address.value) return;
    try {
      const ids = await fetchTemplateIds(address.value);
      const details = await Promise.all(ids.map(fetchTemplateDetails));
      templates.value = details.filter(Boolean) as TemplateItem[];
    } catch (e: unknown) {
      /* non-critical: template refresh */
      templates.value = [];
    }
  };

  const refreshCertificates = async () => {
    if (!address.value) return;
    try {
      const contract = await ensureContractAddress();
      const tokenResult = await invokeRead({
        scriptHash: contract,
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
            scriptHash: contract,
            operation: "GetCertificateDetails",
            args: [{ type: "ByteArray", value: encodeTokenId(tokenId) }],
          });
          const detailParsed = parseInvokeResult(detailResult);
          if (!detailParsed || typeof detailParsed !== "object" || Array.isArray(detailParsed)) return null;
          return parseCertificate(detailParsed as Record<string, unknown>, tokenId);
        })
      );

      certificates.value = details.filter(Boolean) as CertificateItem[];
      await Promise.all(
        certificates.value.map(async (cert) => {
          if (!certQrs[cert.tokenId]) {
            try {
              certQrs[cert.tokenId] = await QRCode.toDataURL(cert.tokenId, { margin: 1 });
            } catch {
              /* QR generation is non-critical */
            }
          }
        })
      );
    } catch (e: unknown) {
      /* non-critical: certificate refresh */
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

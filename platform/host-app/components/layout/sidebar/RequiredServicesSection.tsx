import React from "react";
import { Section } from "./Section";
import { InfoRow } from "./InfoRow";
import { truncateAddress } from "./utils";
import { PLATFORM_SERVICES, PERMISSION_TO_SERVICE } from "./constants";
import type { ThemeColors, ContractInfo, MiniAppPermissions } from "./types";
import type { ChainId } from "../../../lib/chains/types";

interface RequiredServicesSectionProps {
  activeChainId: ChainId;
  permissions?: MiniAppPermissions;
  contractInfo?: ContractInfo;
  explorerBase: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  themeColors: ThemeColors;
  t: (key: string) => string;
}

export function RequiredServicesSection({
  activeChainId,
  permissions,
  contractInfo,
  explorerBase,
  copiedField,
  onCopy,
  themeColors,
  t,
}: RequiredServicesSectionProps) {
  const chainServices = PLATFORM_SERVICES[activeChainId] || {};
  const requiredServices = Object.entries(chainServices).filter(([key]) => {
    const permissionKey = Object.entries(PERMISSION_TO_SERVICE).find(([, serviceKey]) => serviceKey === key)?.[0];
    return permissionKey && permissions?.[permissionKey as keyof MiniAppPermissions];
  });

  if (requiredServices.length === 0) return null;

  return (
    <Section title={t("sidebar.requiredServices")} icon="&#128279;" themeColors={themeColors}>
      {requiredServices.map(([key, service]) => (
        <InfoRow
          key={key}
          label={service.name}
          value={truncateAddress(service.address)}
          fullValue={service.address}
          onCopy={() => onCopy(service.address, key)}
          copied={copiedField === key}
          link={`${explorerBase}/address/${service.address}`}
          themeColors={themeColors}
        />
      ))}
      {contractInfo?.serviceContracts?.map((service, idx) => (
        <InfoRow
          key={`custom-${idx}`}
          label={service.name}
          value={truncateAddress(service.address)}
          fullValue={service.address}
          onCopy={() => onCopy(service.address, `service-${idx}`)}
          copied={copiedField === `service-${idx}`}
          link={`${explorerBase}/address/${service.address}`}
          themeColors={themeColors}
        />
      ))}
    </Section>
  );
}

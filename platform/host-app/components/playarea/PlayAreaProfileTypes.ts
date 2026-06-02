import type { ReactNode } from "react";

import type { OperationParam } from "@/components/types";
import type { PlayTone } from "./PlayAreaShared";

export const ORACLE_APP_LABELS: Record<
  string,
  {
    title: string;
    mode: "http" | "vrf" | "compute" | "seal" | "neodid" | "price";
  }
> = {
  "miniapp-oracle-http-console": { title: "HTTP Oracle Console", mode: "http" },
  "miniapp-oracle-vrf-console": { title: "VRF Request Console", mode: "vrf" },
  "miniapp-oracle-compute-lab": {
    title: "Private Compute Lab",
    mode: "compute",
  },
  "miniapp-oracle-seal-console": { title: "Seal Console", mode: "seal" },
  "miniapp-oracle-neodid-console": {
    title: "NeoDID Oracle Console",
    mode: "neodid",
  },
  "miniapp-oracle-price-console": {
    title: "Price Oracle Console",
    mode: "price",
  },
};

export type ProfileField = {
  key: string;
  label: string;
  defaultValue: string;
  suffix?: string;
  type?: "text" | "number";
  paramType?: OperationParam["type"];
  required?: boolean;
  presets?: OperationParam["presets"];
};

export type ProfileCard = {
  label: string;
  value: string;
};

export type ProfileVisual = {
  headline: string;
  slots: string[];
  footnote?: string;
};

export type PlayAreaProfile = {
  title: string;
  subtitle: string;
  tone: PlayTone;
  icon: ReactNode;
  embeddedHeightClass?: string;
  fields: ProfileField[];
  cards: ProfileCard[];
  steps: string[];
  primaryAction: string;
  visual: ProfileVisual;
};

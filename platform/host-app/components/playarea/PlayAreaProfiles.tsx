import { AA_PROFILED_PLAYAREAS } from "./PlayAreaProfilesAa";
import { BUSINESS_PROFILED_PLAYAREAS } from "./PlayAreaProfilesBusiness";
import type { PlayAreaProfile } from "./PlayAreaProfileTypes";

export { ORACLE_APP_LABELS } from "./PlayAreaProfileTypes";
export type {
  PlayAreaProfile,
  ProfileCard,
  ProfileField,
  ProfileVisual,
} from "./PlayAreaProfileTypes";

export const PROFILED_PLAYAREAS: Record<string, PlayAreaProfile> = {
  ...AA_PROFILED_PLAYAREAS,
  ...BUSINESS_PROFILED_PLAYAREAS,
};

/** Shared label helpers for charity-vault components */

const CATEGORY_LABELS: Record<string, string> = {
  disaster: "Disaster Relief",
  education: "Education",
  health: "Healthcare",
  environment: "Environment",
  poverty: "Poverty Relief",
  animals: "Animal Welfare",
  other: "Other",
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || "Other";
}

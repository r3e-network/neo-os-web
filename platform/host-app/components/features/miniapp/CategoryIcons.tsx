"use client";

// Category-based SVG icons for MiniApp banners
// Each category has a unique decorative icon

export function GamingIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 11H8M7 10V12M16 11H18M17 10V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M2 13C2 10.2386 4.23858 8 7 8H17C19.7614 8 22 10.2386 22 13C22 15.7614 19.7614 18 17 18H7C4.23858 18 2 15.7614 2 13Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function DefiIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function SocialIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5C22 12.27 18.6 15.36 13.45 20.03L12 21.35Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.2"
      />
    </svg>
  );
}

export function GovernanceIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 7V9H21V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5 9V17" stroke="currentColor" strokeWidth="2" />
      <path d="M9 9V17" stroke="currentColor" strokeWidth="2" />
      <path d="M15 9V17" stroke="currentColor" strokeWidth="2" />
      <path d="M19 9V17" stroke="currentColor" strokeWidth="2" />
      <path d="M3 17H21V19H3V17Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 19H22V21H2V19Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function UtilityIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.7 6.3C14.3 5.9 13.7 5.9 13.3 6.3L6.3 13.3C5.9 13.7 5.9 14.3 6.3 14.7L9.3 17.7C9.7 18.1 10.3 18.1 10.7 17.7L17.7 10.7C18.1 10.3 18.1 9.7 17.7 9.3L14.7 6.3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M10 11L13 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 15L21 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 21L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function NftIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9H21" stroke="currentColor" strokeWidth="2" />
      <circle cx="7" cy="6" r="1" fill="currentColor" />
      <circle cx="10" cy="6" r="1" fill="currentColor" />
      <path d="M8 13L10 15L14 11L17 14V17H7V15L8 13Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// Get icon component by category
export function getCategoryIcon(category: string) {
  switch (category) {
    case "gaming":
      return GamingIcon;
    case "defi":
      return DefiIcon;
    case "social":
      return SocialIcon;
    case "governance":
      return GovernanceIcon;
    case "utility":
      return UtilityIcon;
    case "nft":
      return NftIcon;
    default:
      return UtilityIcon;
  }
}

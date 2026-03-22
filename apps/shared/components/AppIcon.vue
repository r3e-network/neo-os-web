<template>
  <component
    :is="resolvedIcon"
    v-if="resolvedIcon"
    :size="size"
    :stroke-width="strokeWidth"
    :style="iconStyle"
    :aria-hidden="ariaHidden"
    :aria-label="ariaLabel"
    :role="presentation"
    :class="['app-icon', `icon-${name}`, sizeClass]"
  />
  <span
    v-else
    :class="['app-icon', 'icon-fallback', `icon-${name}`, sizeClass]"
    :style="customStyle"
    :aria-hidden="ariaHidden"
    :aria-label="ariaLabel"
    :role="presentation"
  >{{ name }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Home,
  Settings,
  User,
  Wallet,
  Book,
  Trophy,
  Star,
  Heart,
  Check,
  Clock,
  Plus,
  X,
  Menu,
  Activity,
  Award,
  Archive,
  Rocket,
  ShoppingCart,
  Ticket,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  Calendar,
  Search,
  Filter,
  Pencil,
  Trash2,
  Copy,
  Share2,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Gem,
  Zap,
  FileText,
  Link2,
  Box,
  Handshake,
  Gift,
  ShieldCheck,
  Crown,
  Gamepad2,
  Mail,
  Flame,
  Moon,
  Target,
  HeartOff,
  Sparkles,
  Camera,
  Medal,
  Eye,
  EyeOff,
  PartyPopper,
  Lock,
  Unlock,
  Link,
  MessageCircle,
  Lightbulb,
  Bell,
  Music,
  Radio,
  Hand,
  Shield,
  Coffee,
  Puzzle,
  Key,
  Skull,
  DollarSign,
  Inbox,
  RefreshCw,
  Wrench,
  Circle,
  CreditCard,
  Smartphone,
  TrendingUp as TrendingUpIcon,
  Brain,
  Droplet,
  CheckCircle,
  PenTool,
  Dices,
  Package,
  Building2,
  Building,
  Pill,
  Globe,
  Store,
  MapPin,
  Bird,
} from "lucide-vue-next";

/**
 * AppIcon Component
 *
 * Renders professional Lucide SVG icons. Maintains backward compatibility with
 * previous emoji-based icon names while providing crisp, consistent SVG rendering.
 *
 * @example
 * ```vue
 * <AppIcon name="home" :size="24" />
 * <AppIcon name="flame" :size="32" label="On fire" />
 * <AppIcon name="locked" decorative />
 * ```
 */
const props = withDefaults(
  defineProps<{
    /** Icon name - maps to Lucide SVG icon */
    name: string;
    /** Icon size in pixels (default: 20) */
    size?: number;
    /** Stroke width (default: 2) */
    strokeWidth?: number;
    /** Icon color */
    color?: string;
    /** Accessibility label - if provided, icon will be announced to screen readers */
    label?: string;
    /** Whether icon is decorative (default: true) */
    decorative?: boolean;
  }>(),
  {
    size: 20,
    strokeWidth: 2,
    color: undefined,
    decorative: true,
  }
);

/** Icon registry: icon name → Lucide component */
const ICON_MAP: Record<string, typeof Home | null> = {
  // Navigation
  home: Home,
  settings: Settings,
  user: User,
  wallet: Wallet,
  book: Book,
  trophy: Trophy,
  star: Star,
  heart: Heart,
  check: Check,
  clock: Clock,
  plus: Plus,
  add: Plus,
  close: X,
  x: X,
  menu: Menu,
  activity: Activity,
  award: Award,
  archive: Archive,
  rocket: Rocket,
  cart: ShoppingCart,
  ticket: Ticket,
  bag: ShoppingBag,

  // Action
  trending: TrendingUp,
  chart: BarChart3,
  calendar: Calendar,
  search: Search,
  filter: Filter,
  edit: Pencil,
  delete: Trash2,
  copy: Copy,
  share: Share2,
  download: Download,
  upload: Upload,

  // Status
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
  fail: X,
  deny: XCircle,
  status_pass: Check,
  status_fail: X,
  confirm: CheckCircle,

  // Crypto
  neo: Gem,
  gas: Zap,
  contract: FileText,
  chain: Link2,
  block: Box,

  // Social
  helpful: Handshake,
  generous: Gift,
  verified: ShieldCheck,
  contributor: Star,
  champion: Trophy,
  legend: Crown,
  game: Gamepad2,
  stats: BarChart3,
  docs: FileText,
  about: Info,
  contact: Mail,

  // App-specific
  flame: Flame,
  sleeping: Moon,
  milestone: Target,
  broken_heart: HeartOff,
  sparkle: Sparkles,
  camera: Camera,
  candle: Flame,
  fuel: Zap,
  eye_hidden: EyeOff,
  eye_visible: Eye,
  moon: Moon,
  party: PartyPopper,
  envelope_red: Mail,
  locked: Lock,
  unlocked: Unlock,
  link: Link,
  chat: MessageCircle,
  bulb: Lightbulb,
  bell: Bell,
  music: Music,
  announce: Radio,
  wave: Hand,
  clap: Hand,
  shield: Shield,
  coffee: Coffee,
  puzzle: Puzzle,
  key: Key,
  skull: Skull,
  dove: Bird,
  tombstone: Building,
  money: DollarSign,
  inbox: Inbox,
  refresh: RefreshCw,
  tools: Wrench,
  crystal_ball: Circle,
  cards: CreditCard,
  signal: Activity,
  globe: Globe,
  store: Store,
  box: Package,
  bank: Building2,
  pill: Pill,
  slot: Dices,
  compass: MapPin,
  phone: Smartphone,
  document: FileText,
  green_circle: Circle,
  chart_up: TrendingUpIcon,
  photo: Camera,
  brain: Brain,
  puzzle_box: Box,
  dice: Dices,
  water_drop: Droplet,
  did: CreditCard,
  pray: Heart,
  signature: PenTool,
};

/** Color for medal rank icons */
const MEDAL_COLORS: Record<string, string> = {
  medal_gold: "#FFD700",
  medal_silver: "#C0C0C0",
  medal_bronze: "#CD7F32",
};

/** Accessibility: Determine if icon should be hidden from screen readers */
const ariaHidden = computed(() => {
  if (props.label) return undefined;
  return props.decorative ? "true" : undefined;
});

/** Accessibility: Role for decorative icons */
const presentation = computed(() => {
  return props.decorative ? "presentation" : undefined;
});

/** Accessibility: Generate aria-label for screen readers */
const ariaLabel = computed(() => {
  if (props.label) return props.label;
  if (!props.decorative) return `${props.name} icon`;
  return undefined;
});

/** Determine size class for CSS styling */
const sizeClass = computed(() => {
  if (props.size <= 16) return "icon-sm";
  if (props.size <= 24) return "icon-md";
  if (props.size <= 32) return "icon-lg";
  return "icon-xl";
});

/** Custom inline style for non-standard sizes */
const customStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${props.size}px`,
}));

/** Inline style for Lucide icon color */
const iconStyle = computed(() => {
  // Medal rank colors
  if (props.name in MEDAL_COLORS) {
    return { color: MEDAL_COLORS[props.name] };
  }
  // Explicit color prop
  if (props.color) {
    return { color: props.color };
  }
  return {};
});

/** Resolve the Lucide component for the given icon name */
const resolvedIcon = computed(() => {
  const icon = ICON_MAP[props.name];
  if (icon) return icon;
  return null;
});
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--transition-fast, var(--transition-normal, 150ms ease));

  &:active {
    transform: scale(0.9);
  }
}

.icon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-weight: var(--font-weight-bold, 700);
  color: var(--icon-fallback-color, var(--text-secondary, rgba(248, 250, 252, 0.7)));
  background: var(--icon-fallback-bg, var(--bg-tertiary, rgba(255, 255, 255, 0.1)));
  border-radius: var(--radius-sm, 4px);
}

@media (prefers-reduced-motion: reduce) {
  .app-icon {
    transition: none;
    &:active {
      transform: none;
    }
  }
}
</style>

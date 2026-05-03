import React, { useMemo, type CSSProperties } from "react";
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
  Layers,
  Building2,
  Building,
  Pill,
  Globe,
  Store,
  MapPin,
  Bird,
  AppWindow,
  ArrowDown,
  BadgeCheck,
  Coins,
  Cpu,
  Flag,
  Folder,
  Gamepad,
  Grid3X3,
  Hash,
  Image,
  Landmark,
  LayoutDashboard,
  List,
  Percent,
  Play,
  Repeat,
  ScrollText,
  Send,
  SlidersHorizontal,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import "./AppIcon.scss";

export interface AppIconProps {
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
  className?: string;
}

/** Icon registry: icon name -> Lucide component */
const ICON_MAP: Record<string, LucideIcon> = {
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
  "check-circle": CheckCircle2,
  "x-circle": XCircle,
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
  "bar-chart": BarChart3,
  "bar-chart-2": BarChart3,
  "bar-chart-3": BarChart3,
  calendar: Calendar,
  search: Search,
  filter: Filter,
  edit: Pencil,
  delete: Trash2,
  "trash-2": Trash2,
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
  gamepad: Gamepad,
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
  eye: Eye,
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
  "dollar-sign": DollarSign,
  inbox: Inbox,
  refresh: RefreshCw,
  "refresh-cw": RefreshCw,
  tools: Wrench,
  crystal_ball: Circle,
  cards: CreditCard,
  "credit-card": CreditCard,
  signal: Activity,
  globe: Globe,
  store: Store,
  box: Package,
  layers: Layers,
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
  "pen-tool": PenTool,
  "alert-triangle": AlertTriangle,
  "app-window": AppWindow,
  "arrow-down": ArrowDown,
  badge: BadgeCheck,
  coin: Coins,
  cpu: Cpu,
  flag: Flag,
  folder: Folder,
  grid: Grid3X3,
  hash: Hash,
  image: Image,
  landmark: Landmark,
  layout: LayoutDashboard,
  list: List,
  none: Circle,
  percent: Percent,
  play: Play,
  repeat: Repeat,
  scroll: ScrollText,
  send: Send,
  sliders: SlidersHorizontal,
  "shield-check": ShieldCheck,
  "trending-up": TrendingUp,
  users: Users,
  viewport: AppWindow,
  wifi: Wifi,
};

/** Color for medal rank icons */
const MEDAL_COLORS: Record<string, string> = {
  medal_gold: "#FFD700",
  medal_silver: "#C0C0C0",
  medal_bronze: "#CD7F32",
};

export function AppIcon({
  name,
  size = 20,
  strokeWidth = 2,
  color,
  label,
  decorative = true,
  className,
}: AppIconProps) {
  const sizeClass = size <= 16 ? "icon-sm" : size <= 24 ? "icon-md" : size <= 32 ? "icon-lg" : "icon-xl";

  const ariaHidden = label ? undefined : decorative ? true : undefined;
  const role = decorative ? "presentation" : undefined;
  const ariaLabel = label ? label : !decorative ? `${name} icon` : undefined;

  const iconStyle = useMemo<CSSProperties>(() => {
    if (name in MEDAL_COLORS) return { color: MEDAL_COLORS[name] };
    if (color) return { color };
    return {};
  }, [name, color]);

  const IconComponent = ICON_MAP[name];

  if (IconComponent) {
    return (
      <IconComponent
        size={size}
        strokeWidth={strokeWidth}
        style={iconStyle}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        role={role}
        className={["app-icon", `icon-${name}`, sizeClass, className].filter(Boolean).join(" ")}
      />
    );
  }

  const customStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${size}px`,
    ...iconStyle,
  };

  return (
    <span
      className={["app-icon", "icon-fallback", `icon-${name}`, sizeClass, className].filter(Boolean).join(" ")}
      style={customStyle}
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
      role={role}
    >
      {/[^\w-]/.test(name) ? name : ""}
    </span>
  );
}

export default AppIcon;

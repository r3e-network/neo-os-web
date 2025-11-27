// Service Layer Types - Industry Standard Implementation

export interface Service {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  status: ServiceStatus;
  pricing: PricingModel;
  features: string[];
  requirements: string[];
  deliveryTime: string;
  supportLevel: SupportLevel;
  metadata: ServiceMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface PricingModel {
  type: 'fixed' | 'hourly' | 'subscription' | 'custom';
  basePrice: number;
  currency: string;
  billingCycle?: 'monthly' | 'quarterly' | 'annually';
  tiers?: PricingTier[];
  customPricing?: CustomPricing;
}

export interface PricingTier {
  name: string;
  price: number;
  features: string[];
  limitations: string[];
  recommended: boolean;
}

export interface CustomPricing {
  minPrice: number;
  maxPrice: number;
  pricingFactors: string[];
  consultationRequired: boolean;
}

export interface ServiceMetadata {
  complexity: 'low' | 'medium' | 'high' | 'enterprise';
  teamSize: number;
  technologies: string[];
  industries: string[];
  caseStudies: CaseStudy[];
  testimonials: Testimonial[];
  ratings: ServiceRatings;
}

export interface CaseStudy {
  id: string;
  title: string;
  description: string;
  client: string;
  industry: string;
  challenge: string;
  solution: string;
  results: string[];
  duration: string;
  imageUrl?: string;
}

export interface Testimonial {
  id: string;
  clientName: string;
  clientTitle: string;
  clientCompany: string;
  rating: number;
  content: string;
  serviceId: string;
  date: string;
  verified: boolean;
}

export interface ServiceRatings {
  average: number;
  totalReviews: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export type ServiceStatus = 'active' | 'maintenance' | 'deprecated' | 'coming-soon';
export type SupportLevel = 'basic' | 'standard' | 'premium' | 'enterprise';

// Service Request and Order Types
export interface ServiceRequest {
  id: string;
  serviceId: string;
  userId: string;
  status: RequestStatus;
  priority: RequestPriority;
  details: ServiceRequestDetails;
  requirements: ServiceRequirement[];
  timeline: ServiceTimeline;
  budget: BudgetInfo;
  attachments: Attachment[];
  communications: Communication[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestDetails {
  description: string;
  objectives: string[];
  constraints: string[];
  preferredApproach?: string;
  additionalNotes?: string;
}

export interface ServiceRequirement {
  id: string;
  type: 'functional' | 'technical' | 'business' | 'compliance';
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  acceptanceCriteria: string[];
}

export interface ServiceTimeline {
  startDate?: string;
  endDate?: string;
  milestones: Milestone[];
  flexibility: 'fixed' | 'flexible' | 'negotiable';
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  deliverables: string[];
}

export interface BudgetInfo {
  minBudget: number;
  maxBudget: number;
  currency: string;
  paymentSchedule: PaymentSchedule;
}

export interface PaymentSchedule {
  type: 'milestone' | 'time-based' | 'deliverable' | 'upfront';
  milestones?: PaymentMilestone[];
}

export interface PaymentMilestone {
  name: string;
  percentage: number;
  amount: number;
  conditions: string[];
}

export interface Attachment {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  url: string;
}

export interface Communication {
  id: string;
  type: 'message' | 'update' | 'document' | 'meeting';
  sender: string;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
}

export type RequestStatus = 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected' | 'in-progress' | 'completed' | 'cancelled';
export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent';

// Service Order Types
export interface ServiceOrder {
  id: string;
  requestId: string;
  serviceId: string;
  userId: string;
  status: OrderStatus;
  pricing: OrderPricing;
  deliverables: ServiceDeliverable[];
  timeline: OrderTimeline;
  payment: PaymentInfo;
  support: SupportInfo;
  createdAt: string;
  updatedAt: string;
}

export interface OrderPricing {
  totalAmount: number;
  currency: string;
  breakdown: PricingBreakdown[];
  discounts: Discount[];
  taxes: Tax[];
}

export interface PricingBreakdown {
  item: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  description?: string;
}

export interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
  reason: string;
  appliedTo: string;
}

export interface Tax {
  name: string;
  rate: number;
  amount: number;
  jurisdiction: string;
}

export interface ServiceDeliverable {
  id: string;
  name: string;
  description: string;
  type: 'document' | 'software' | 'design' | 'consultation' | 'other';
  format: string;
  deadline: string;
  status: DeliverableStatus;
  acceptanceCriteria: string[];
  reviewNotes?: string;
}

export type DeliverableStatus = 'pending' | 'in-progress' | 'submitted' | 'under-review' | 'approved' | 'rejected' | 'delivered';
export type OrderStatus = 'pending' | 'confirmed' | 'in-progress' | 'ready-for-review' | 'completed' | 'delivered' | 'cancelled' | 'refunded';

export interface OrderTimeline {
  startDate: string;
  estimatedCompletion: string;
  actualCompletion?: string;
  phases: OrderPhase[];
}

export interface OrderPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  deliverables: string[];
}

export type PhaseStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed' | 'blocked';

export interface PaymentInfo {
  status: PaymentStatus;
  method: PaymentMethod;
  transactions: Transaction[];
  refundPolicy: RefundPolicy;
}

export interface Transaction {
  id: string;
  type: 'charge' | 'refund' | 'partial-refund';
  amount: number;
  currency: string;
  status: TransactionStatus;
  gateway: string;
  referenceId: string;
  timestamp: string;
}

export interface RefundPolicy {
  eligible: boolean;
  conditions: string[];
  timeframe: string;
  processingTime: string;
}

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'refunded' | 'disputed';
export type PaymentMethod = 'credit-card' | 'bank-transfer' | 'paypal' | 'cryptocurrency' | 'invoice';
export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'disputed';

export interface SupportInfo {
  level: SupportLevel;
  contacts: SupportContact[];
  sla: ServiceLevelAgreement;
  escalation: EscalationProcedure;
}

export interface SupportContact {
  type: 'email' | 'phone' | 'chat' | 'ticket';
  value: string;
  availability: string;
  responseTime: string;
}

export interface ServiceLevelAgreement {
  responseTime: string;
  resolutionTime: string;
  uptime: number;
  supportHours: string;
  escalationTime: string;
}

export interface EscalationProcedure {
  levels: EscalationLevel[];
  criteria: string[];
  timeframe: string;
}

export interface EscalationLevel {
  level: number;
  contact: string;
  responseTime: string;
  authority: string[];
}
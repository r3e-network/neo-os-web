import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import { requireMiniAppAdmin, AdminActor } from "@/lib/admin-auth";
import { logAuthorizationEvent } from "./audit-log";

/**
 * Permission types
 */
export type Permission =
  | "miniapp:read"
  | "miniapp:write"
  | "miniapp:admin"
  | "miniapp:submit"
  | "chat:read"
  | "chat:write"
  | "review:read"
  | "review:write"
  | "stats:read"
  | "admin:write"
  | "admin:read";

/**
 * Resource types for permission checks
 */
export type ResourceType = "miniapp" | "chat" | "review" | "stats" | "admin" | "submission";

/**
 * Permission requirement interface
 */
export interface PermissionRequirement {
  permission: Permission;
  resource?: string;
  resourceType?: ResourceType;
}

/**
 * Owner check function type
 */
type OwnerChecker = (resourceOwner: string, actor: string) => boolean | Promise<boolean>;

/**
 * Checks if a permission matches the required permission
 */
function hasPermission(userPermissions: Permission[], required: Permission): boolean {
  // Admin permission grants all
  if (userPermissions.includes("admin:write")) {
    return true;
  }
  
  return userPermissions.includes(required);
}

/**
 * Default owner checker - simple equality check
 */
const defaultOwnerChecker: OwnerChecker = (resourceOwner, actor) => {
  return resourceOwner === actor;
};

/**
 * Creates a permission requirement from a permission string
 */
export function requirePermission(permission: Permission) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<boolean> => {
    // Check authentication first
    const wallet = await requireWalletAuth(req, res);
    
    if (!wallet) {
      logAuthorizationEvent(req, false, {
        actor: wallet || undefined,
        resource: permission,
        errorMessage: "Authentication required",
      });
      return false;
    }
    
    // Use an environment-backed admin allowlist plus default authenticated permissions.
    const permissions = getPermissionsForWallet(wallet);
    
    if (!hasPermission(permissions, permission)) {
      logAuthorizationEvent(req, false, {
        actor: wallet || undefined,
        resource: permission,
        errorMessage: "Insufficient permissions",
      });
      apiError.forbidden(res, "Insufficient permissions");
      return false;
    }
    
    logAuthorizationEvent(req, true, {
      actor: wallet || undefined,
      resource: permission,
    });
    
    return true;
  };
}

/**
 * Gets permissions for a wallet (simplified implementation)
 * In production, this would query a permissions database
 */
export function getPermissionsForWallet(wallet: string): Permission[] {
  // Check against admin wallets from environment
  const adminWallets = String(process.env.MINIAPP_ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  
  if (adminWallets.includes(wallet.toLowerCase())) {
    return [
      "miniapp:read",
      "miniapp:write",
      "miniapp:admin",
      "miniapp:submit",
      "chat:read",
      "chat:write",
      "review:read",
      "review:write",
      "stats:read",
      "admin:write",
      "admin:read",
    ];
  }
  
  // Default permissions for authenticated users
  return [
    "miniapp:read",
    "miniapp:submit",
    "chat:read",
    "chat:write",
    "review:read",
    "review:write",
    "stats:read",
  ];
}

/**
 * Creates a resource owner permission check
 */
export function requireResourceOwner(
  resourceType: ResourceType,
  ownerField: string = "owner"
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<boolean> => {
    const wallet = await requireWalletAuth(req, res);
    
    if (!wallet) {
      return false;
    }
    
    // Extract resource owner from request body or query
    const resourceOwner = req.body?.[ownerField] ?? req.query?.[ownerField];
    
    if (!resourceOwner) {
      apiError.badRequest(res, `Missing ${ownerField} field`);
      return false;
    }
    
    if (resourceOwner !== wallet) {
      logAuthorizationEvent(req, false, {
        actor: wallet || undefined,
        resource: `${resourceType}:${resourceOwner}`,
        action: "owner_check",
        errorMessage: `Not the owner of this ${resourceType}`,
      });
      apiError.forbidden(res, `You are not the owner of this ${resourceType}`);
      return false;
    }
    
    return true;
  };
}

/**
 * Middleware to check multiple permissions
 */
export function requirePermissions(...requirements: PermissionRequirement[]) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<boolean> => {
    const wallet = await requireWalletAuth(req, res);
    
    if (!wallet) {
      return false;
    }
    
    const permissions = getPermissionsForWallet(wallet);
    
    for (const requirement of requirements) {
      if (!hasPermission(permissions, requirement.permission)) {
        logAuthorizationEvent(req, false, {
          actor: wallet || undefined,
          resource: requirement.permission,
          errorMessage: "Missing required permission",
        });
        apiError.forbidden(res, `Missing required permission: ${requirement.permission}`);
        return false;
      }
    }
    
    return true;
  };
}

/**
 * Check if user can perform action on resource
 */
export async function canPerformAction(
  req: NextApiRequest,
  res: NextApiResponse,
  action: "read" | "write" | "admin",
  resourceType: ResourceType,
  resourceOwner?: string
): Promise<boolean> {
  const wallet = await requireWalletAuth(req, res);
  
  if (!wallet) {
    return false;
  }
  
  // Admin can do anything
  const adminWallets = String(process.env.MINIAPP_ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  
  if (adminWallets.includes(wallet.toLowerCase())) {
    return true;
  }
  
  // Check specific permissions based on action
  const permissionMap: Record<string, Permission> = {
    "miniapp:read": "miniapp:read",
    "miniapp:write": "miniapp:write",
    "miniapp:admin": "miniapp:admin",
    "chat:read": "chat:read",
    "chat:write": "chat:write",
    "review:read": "review:read",
    "review:write": "review:write",
    "stats:read": "stats:read",
    "admin:write": "admin:write",
  };
  
  const permissionKey = `${resourceType}:${action}`;
  const requiredPermission = permissionMap[permissionKey];
  
  if (!requiredPermission) {
    return false;
  }
  
  const permissions = getPermissionsForWallet(wallet);
  
  if (!hasPermission(permissions, requiredPermission)) {
    return false;
  }
  
  // If checking ownership and resource owner is provided
  if (resourceOwner && resourceOwner !== wallet) {
    // For write actions, check ownership
    if (action === "write") {
      return false;
    }
  }
  
  return true;
}

/**
 * Creates a permission-gated handler wrapper
 */
export function withPermission(
  permission: Permission,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const wallet = await requireWalletAuth(req, res);
    
    if (!wallet) {
      return;
    }
    
    const permissions = getPermissionsForWallet(wallet);
    
    if (!hasPermission(permissions, permission)) {
      logAuthorizationEvent(req, false, {
        actor: wallet || undefined,
        resource: permission,
        errorMessage: "Permission denied",
      });
      apiError.forbidden(res, "Permission denied");
      return;
    }
    
    logAuthorizationEvent(req, true, {
      actor: wallet || undefined,
      resource: permission,
    });
    
    return handler(req, res);
  };
}

/**
 * Creates an admin-only handler wrapper
 */
export function withAdminPermission(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const admin = await requireMiniAppAdmin(req, res);
    
    if (!admin) {
      return;
    }
    
    logAdminAction(req, true, {
      actor: admin.value,
      action: "admin_access",
    });
    
    return handler(req, res);
  };
}

function logAdminAction(
  req: NextApiRequest,
  success: boolean,
  options: {
    actor?: string;
    action?: string;
    resource?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
  }
): void {
  // Simplified admin action logging
  const { logger } = require("@/lib/logger");
  
  if (!success) {
    logger.warn(`[ADMIN_ACTION_FAILED] actor=${options.actor} action=${options.action} error=${options.errorMessage}`);
  } else {
    logger.info(`[ADMIN_ACTION] actor=${options.actor} action=${options.action}`);
  }
}

/**
 * Role-based access control (RBAC) definitions
 */
export const Roles = {
  ANONYMOUS: "anonymous",
  USER: "user",
  DEVELOPER: "developer",
  ADMIN: "admin",
} as const;

export type Role = typeof Roles[keyof typeof Roles];

export const RolePermissions: Record<Role, Permission[]> = {
  [Roles.ANONYMOUS]: [],
  [Roles.USER]: [
    "miniapp:read",
    "chat:read",
    "chat:write",
    "review:read",
    "review:write",
    "stats:read",
  ],
  [Roles.DEVELOPER]: [
    "miniapp:read",
    "miniapp:write",
    "miniapp:submit",
    "chat:read",
    "chat:write",
    "review:read",
    "review:write",
    "stats:read",
  ],
  [Roles.ADMIN]: [
    "miniapp:read",
    "miniapp:write",
    "miniapp:admin",
    "miniapp:submit",
    "chat:read",
    "chat:write",
    "review:read",
    "review:write",
    "stats:read",
    "admin:write",
    "admin:read",
  ],
};

/**
 * Gets role for a wallet
 */
export function getRoleForWallet(wallet: string): Role {
  const adminWallets = String(process.env.MINIAPP_ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  
  if (adminWallets.includes(wallet.toLowerCase())) {
    return Roles.ADMIN;
  }
  
  // Check if developer (has submitted apps)
  // This would need database integration in production
  return Roles.USER;
}

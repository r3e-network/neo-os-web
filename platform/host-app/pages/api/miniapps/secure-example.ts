/**
 * Example API route demonstrating the new security utilities
 *
 * This shows how to use:
 * - createApiHandler for standardized route handling
 * - Input validation with schemas
 * - Audit logging
 * - Permission checking
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createApiHandler, protectedEndpoint } from "@/lib/api-middleware";
import { validateObject, FieldSchema } from "@/lib/security/input-validation";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import { getRoleForWallet, Roles } from "@/lib/security/permissions";
import { logDataModification } from "@/lib/security/audit-log";

/**
 * Request body schema for creating a miniapp
 */
const createMiniAppSchema: Record<string, FieldSchema> = {
  name: {
    type: "string",
    required: true,
    minLength: 1,
    maxLength: 64,
  },
  description: {
    type: "string",
    required: true,
    minLength: 1,
    maxLength: 2000,
  },
  category: {
    type: "string",
    required: true,
  },
  entry_url: {
    type: "string",
    required: true,
  },
  contract_hash: {
    type: "string",
    required: false,
  },
};

/**
 * Query parameter schema
 */
const querySchema: Record<string, FieldSchema> = {
  status: {
    type: "string",
    required: false,
  },
  limit: {
    type: "string",
    required: false,
    maxLength: 3,
  },
};

/**
 * GET handler - Publicly accessible with rate limiting
 */
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { status = "active", limit = "50" } = req.query;

  // Validate query params are already handled by createApiHandler

  // In production, fetch from database
  const data = {
    apps: [],
    total: 0,
    status,
    limit: parseInt(limit as string, 10),
  };

  res.status(200).json(data);
  return;
}

/**
 * POST handler - Protected, requires authentication
 */
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  // Validate request body
  const validationResult = validateObject(req.body, createMiniAppSchema);

  if (!validationResult.valid) {
    apiError.badRequest(res, validationResult.errors.join("; "));
    return;
  }

  // Get authenticated wallet
  const wallet = await requireWalletAuth(req, res);
  if (!wallet) return;

  // Check role
  const role = getRoleForWallet(wallet);

  // Log the action
  logDataModification(req, true, {
    actor: wallet,
    resource: "miniapp",
    action: "create",
    details: {
      name: req.body.name,
      category: req.body.category,
      role,
    },
  });

  // In production, create in database
  const newApp = {
    app_id: `app-${Date.now()}`,
    name: req.body.name,
    description: req.body.description,
    category: req.body.category,
    entry_url: req.body.entry_url,
    contract_hash: req.body.contract_hash,
    status: role === Roles.ADMIN ? "active" : "pending",
    created_at: new Date().toISOString(),
  };

  logger.info(`MiniApp created: ${newApp.app_id} by ${wallet}`);

  res.status(201).json({
    success: true,
    app: newApp,
  });
  return;
}

/**
 * Main handler using createApiHandler
 */
const handler = createApiHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    switch (req.method) {
      case "GET":
        return handleGet(req, res);

      case "POST":
        return handlePost(req, res);

      default:
        return apiError.methodNotAllowed(res);
    }
  },
  {
    allowedMethods: ["GET", "POST"],
    requireCsrf: true,
    rateLimit: true,
    querySchema,
  },
);

export default handler;

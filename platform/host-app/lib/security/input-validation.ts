import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logValidationFailure } from "./audit-log";

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  // Neo N3 address pattern
  NEO_ADDRESS: /^N[A-Za-z0-9]{33}$/,
  
  // Contract hash pattern (0x prefixed)
  CONTRACT_HASH: /^0x[0-9a-fA-F]{40}$/,
  
  // App ID pattern (alphanumeric with . _ -)
  APP_ID: /^[a-z0-9][a-z0-9._-]*$/,
  
  // Email pattern
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // URL pattern (http/https only)
  URL: /^https?:\/\/.+/i,
} as const;

/**
 * Length constraints
 */
export const LengthConstraints = {
  APP_ID_MIN: 3,
  APP_ID_MAX: 64,
  NAME_MIN: 1,
  NAME_MAX: 64,
  DESCRIPTION_MAX: 2000,
  MESSAGE_MAX: 500,
  WALLET_ADDRESS_LENGTH: 34,
} as const;

/**
 * Validates a Neo N3 address
 */
export function isValidNeoAddress(address: string): boolean {
  return ValidationRules.NEO_ADDRESS.test(address);
}

/**
 * Validates a contract hash
 */
export function isValidContractHash(hash: string): boolean {
  return ValidationRules.CONTRACT_HASH.test(hash);
}

/**
 * Validates an app ID
 */
export function isValidAppId(appId: string): boolean {
  return (
    ValidationRules.APP_ID.test(appId) &&
    appId.length >= LengthConstraints.APP_ID_MIN &&
    appId.length <= LengthConstraints.APP_ID_MAX
  );
}

/**
 * Validates a URL (http/https only, no javascript:, data:, etc.)
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  
  // Check for dangerous protocols
  const lowerUrl = url.toLowerCase().trim();
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
  if (dangerousProtocols.some((p) => lowerUrl.startsWith(p))) {
    return false;
  }
  
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validates an email address
 */
export function isValidEmail(email: string): boolean {
  return ValidationRules.EMAIL.test(email);
}

/**
 * Validates string length
 */
export function isValidLength(
  value: string,
  min: number,
  max: number
): boolean {
  return value.length >= min && value.length <= max;
}

/**
 * Sanitizes a string to prevent XSS
 */
export function sanitizeString(value: unknown): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  
  // Remove null bytes and control characters (except newlines, tabs)
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

/**
 * Validates and sanitizes a string value
 */
export function validateString(
  value: unknown,
  options?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowHtml?: boolean;
    fieldName?: string;
  }
): ValidationResult {
  const errors: string[] = [];
  const fieldName = options?.fieldName ?? "value";
  
  // Check required
  if (options?.required) {
    if (value === undefined || value === null || value === "") {
      errors.push(`${fieldName} is required`);
      return { valid: false, errors };
    }
  }
  
  // Skip further validation if empty and not required
  if (value === undefined || value === null || value === "") {
    return { valid: true, errors: [] };
  }
  
  const strValue = String(value);
  
  // Check min length
  if (options?.minLength !== undefined && strValue.length < options.minLength) {
    errors.push(`${fieldName} must be at least ${options.minLength} characters`);
  }
  
  // Check max length
  if (options?.maxLength !== undefined && strValue.length > options.maxLength) {
    errors.push(`${fieldName} must be at most ${options.maxLength} characters`);
  }
  
  // Check pattern
  if (options?.pattern && !options.pattern.test(strValue)) {
    errors.push(`${fieldName} has invalid format`);
  }
  
  // Check HTML if not allowed
  if (!options?.allowHtml) {
    const htmlPattern = /<[^>]*>/i;
    if (htmlPattern.test(strValue)) {
      errors.push(`${fieldName} must not contain HTML`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Neo address field
 */
export function validateNeoAddress(
  value: unknown,
  fieldName = "address"
): ValidationResult {
  const errors: string[] = [];
  
  if (!value || typeof value !== "string") {
    errors.push(`${fieldName} is required`);
    return { valid: false, errors };
  }
  
  const trimmed = value.trim();
  if (!isValidNeoAddress(trimmed)) {
    errors.push(`${fieldName} must be a valid Neo N3 address`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a contract hash field
 */
export function validateContractHash(
  value: unknown,
  fieldName = "contract_hash"
): ValidationResult {
  const errors: string[] = [];
  
  // Contract hash is optional
  if (!value || value === "") {
    return { valid: true, errors: [] };
  }
  
  if (typeof value !== "string") {
    errors.push(`${fieldName} must be a string`);
    return { valid: false, errors };
  }
  
  const trimmed = value.trim();
  if (!isValidContractHash(trimmed)) {
    errors.push(`${fieldName} must be a valid contract hash (0x...)`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an app ID field
 */
export function validateAppId(
  value: unknown,
  fieldName = "app_id"
): ValidationResult {
  const errors: string[] = [];
  
  if (!value || typeof value !== "string") {
    errors.push(`${fieldName} is required`);
    return { valid: false, errors };
  }
  
  const trimmed = value.trim().toLowerCase();
  if (!isValidAppId(trimmed)) {
    errors.push(
      `${fieldName} must be ${LengthConstraints.APP_ID_MIN}-${LengthConstraints.APP_ID_MAX} characters, ` +
      "start with alphanumeric, and contain only letters, numbers, dots, hyphens, and underscores"
    );
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a URL field
 */
export function validateUrl(
  value: unknown,
  fieldName = "url",
  required = false
): ValidationResult {
  const errors: string[] = [];
  
  if (!value || (typeof value === "string" && value.trim() === "")) {
    if (required) {
      errors.push(`${fieldName} is required`);
    }
    return { valid: errors.length === 0, errors };
  }
  
  if (!isValidUrl(String(value))) {
    errors.push(`${fieldName} must be a valid HTTP/HTTPS URL`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an enum field
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): ValidationResult {
  const errors: string[] = [];
  
  if (value === undefined || value === null) {
    return { valid: true, errors: [] };
  }
  
  if (!allowedValues.includes(value as T)) {
    errors.push(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`
    );
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an object with a schema
 */
export interface FieldSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  schema?: Record<string, FieldSchema>;
  itemSchema?: FieldSchema;
}

export function validateObject(
  value: unknown,
  schema: Record<string, FieldSchema>,
  prefix = ""
): ValidationResult {
  const errors: string[] = [];
  
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${prefix || "value"} must be an object`);
    return { valid: false, errors };
  }
  
  const obj = value as Record<string, unknown>;
  
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fieldValue = obj[fieldName];
    const fieldPrefix = prefix ? `${prefix}.${fieldName}` : fieldName;
    
    // Check required
    if (fieldSchema.required && (fieldValue === undefined || fieldValue === null)) {
      errors.push(`${fieldPrefix} is required`);
      continue;
    }
    
    // Skip validation if empty and not required
    if (fieldValue === undefined || fieldValue === null) {
      continue;
    }
    
    // Type check
    const actualType = Array.isArray(fieldValue) ? "array" : typeof fieldValue;
    if (actualType !== fieldSchema.type) {
      errors.push(`${fieldPrefix} must be of type ${fieldSchema.type}`);
      continue;
    }
    
    // String-specific validations
    if (fieldSchema.type === "string") {
      const strValue = String(fieldValue);
      if (fieldSchema.minLength !== undefined && strValue.length < fieldSchema.minLength) {
        errors.push(`${fieldPrefix} must be at least ${fieldSchema.minLength} characters`);
      }
      if (fieldSchema.maxLength !== undefined && strValue.length > fieldSchema.maxLength) {
        errors.push(`${fieldPrefix} must be at most ${fieldSchema.maxLength} characters`);
      }
      if (fieldSchema.pattern && !fieldSchema.pattern.test(strValue)) {
        errors.push(`${fieldPrefix} has invalid format`);
      }
    }
    
    // Number-specific validations
    if (fieldSchema.type === "number") {
      const numValue = Number(fieldValue);
      if (isNaN(numValue)) {
        errors.push(`${fieldPrefix} must be a valid number`);
      }
    }
    
    // Object validation
    if (fieldSchema.type === "object" && fieldSchema.schema) {
      const nestedResult = validateObject(fieldValue, fieldSchema.schema, fieldPrefix);
      errors.push(...nestedResult.errors);
    }
    
    // Array validation
    if (fieldSchema.type === "array" && fieldSchema.itemSchema) {
      if (!Array.isArray(fieldValue)) {
        errors.push(`${fieldPrefix} must be an array`);
      } else {
        fieldValue.forEach((item, index) => {
          const itemResult = validateItem(item, fieldSchema.itemSchema!, `${fieldPrefix}[${index}]`);
          errors.push(...itemResult.errors);
        });
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

function validateItem(
  value: unknown,
  schema: FieldSchema,
  fieldPrefix: string
): ValidationResult {
  const errors: string[] = [];
  
  if (value === undefined || value === null) {
    if (schema.required) {
      errors.push(`${fieldPrefix} is required`);
    }
    return { valid: errors.length === 0, errors };
  }
  
  const actualType = Array.isArray(value) ? "array" : typeof value;
  if (actualType !== schema.type) {
    errors.push(`${fieldPrefix} must be of type ${schema.type}`);
    return { valid: false, errors };
  }
  
  // Recursively validate nested objects/arrays
  if (schema.type === "object" && schema.schema) {
    const result = validateObject(value, schema.schema, fieldPrefix);
    errors.push(...result.errors);
  }
  
  if (schema.type === "array" && schema.itemSchema) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const itemResult = validateItem(item, schema.itemSchema!, `${fieldPrefix}[${index}]`);
        errors.push(...itemResult.errors);
      });
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Middleware factory for request validation
 */
export function withValidation(schema: Record<string, FieldSchema>) {
  return function validationMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => void | Promise<void>
  ): void | Promise<void> {
    const result = validateObject(req.body, schema);
    
    if (!result.valid) {
      logValidationFailure(req, result.errors, {
        resource: req.url ?? "unknown",
      });
      apiError.badRequest(res, result.errors.join("; "));
      return;
    }
    
    return next();
  };
}

/**
 * Query parameter validation helper
 */
export function validateQueryParams(
  req: NextApiRequest,
  schema: Record<string, FieldSchema>
): ValidationResult {
  const errors: string[] = [];
  const query = req.query;
  
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fieldValue = query[fieldName];
    
    // Check required
    if (fieldSchema.required && !fieldValue) {
      errors.push(`Query parameter ${fieldName} is required`);
      continue;
    }
    
    // Skip if empty
    if (!fieldValue) continue;
    
    const strValue = Array.isArray(fieldValue) ? fieldValue[0] : String(fieldValue);
    
    // String validations
    if (fieldSchema.type === "string") {
      if (fieldSchema.minLength !== undefined && strValue.length < fieldSchema.minLength) {
        errors.push(`Query parameter ${fieldName} must be at least ${fieldSchema.minLength} characters`);
      }
      if (fieldSchema.maxLength !== undefined && strValue.length > fieldSchema.maxLength) {
        errors.push(`Query parameter ${fieldName} must be at most ${fieldSchema.maxLength} characters`);
      }
      if (fieldSchema.pattern && !fieldSchema.pattern.test(strValue)) {
        errors.push(`Query parameter ${fieldName} has invalid format`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

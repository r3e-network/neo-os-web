import schema from "@/public/miniapp-definitions/miniapp-config.schema.json";

type ValidationResult = {
  valid: boolean;
  error?: string;
};

type Dict = Record<string, unknown>;

const rootSchema = schema as Dict;

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toPath(path: string[], key: string): string {
  if (!path.length) return key;
  return `${path.join(".")}.${key}`;
}

function resolveRef(schemaNode: Dict): Dict {
  const ref = asString(schemaNode.$ref).trim();
  if (!ref.startsWith("#/")) return schemaNode;

  const segments = ref.slice(2).split("/").filter(Boolean);
  let current: unknown = rootSchema;
  for (const segment of segments) {
    current = asObject(current)[segment];
  }

  const resolved = asObject(current);
  if (!Object.keys(resolved).length) return schemaNode;
  const merged = { ...resolved, ...schemaNode };
  delete merged.$ref;
  return merged;
}

function validateValueAgainstEnum(value: unknown, enumValues: unknown[]): boolean {
  return enumValues.some((candidate) => candidate === value);
}

function typeMatches(value: unknown, typeName: string): boolean {
  if (typeName === "string") return typeof value === "string";
  if (typeName === "boolean") return typeof value === "boolean";
  if (typeName === "object") return Boolean(value && typeof value === "object" && !Array.isArray(value));
  if (typeName === "array") return Array.isArray(value);
  if (typeName === "number") return typeof value === "number";
  if (typeName === "integer") return typeof value === "number" && Number.isInteger(value);
  return true;
}

function validateNode(value: unknown, schemaNode: Dict, path: string[] = []): ValidationResult {
  const resolved = resolveRef(schemaNode);

  const allOf = asArray(resolved.allOf);
  if (allOf.length > 0) {
    for (const candidate of allOf) {
      const result = validateNode(value, asObject(candidate), path);
      if (!result.valid) return result;
    }
  }

  const oneOf = asArray(resolved.oneOf);
  if (oneOf.length > 0) {
    for (const candidate of oneOf) {
      const result = validateNode(value, asObject(candidate), path);
      if (result.valid) return { valid: true };
    }
    return { valid: false, error: `${path.join(".") || "value"} does not match any allowed schema` };
  }

  const typeName = asString(resolved.type).trim();
  if (typeName && !typeMatches(value, typeName)) {
    return {
      valid: false,
      error: `${path.join(".") || "value"} must be of type ${typeName}`,
    };
  }

  const enumValues = asArray(resolved.enum);
  if (enumValues.length > 0 && !validateValueAgainstEnum(value, enumValues)) {
    return {
      valid: false,
      error: `${path.join(".") || "value"} must be one of: ${enumValues.map((item) => String(item)).join(", ")}`,
    };
  }

  if (typeof value === "string") {
    const minLengthRaw = resolved.minLength;
    const maxLengthRaw = resolved.maxLength;
    const minLength = typeof minLengthRaw === "number" ? minLengthRaw : undefined;
    const maxLength = typeof maxLengthRaw === "number" ? maxLengthRaw : undefined;
    if (minLength !== undefined && value.length < minLength) {
      return { valid: false, error: `${path.join(".") || "value"} must have at least ${minLength} characters` };
    }
    if (maxLength !== undefined && value.length > maxLength) {
      return { valid: false, error: `${path.join(".") || "value"} must have at most ${maxLength} characters` };
    }

    const pattern = asString(resolved.pattern).trim();
    if (pattern) {
      try {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          return { valid: false, error: `${path.join(".") || "value"} has invalid format` };
        }
      } catch {
        // Ignore invalid pattern in schema.
      }
    }
  }

  if (Array.isArray(value)) {
    const maxItemsRaw = resolved.maxItems;
    const maxItems = typeof maxItemsRaw === "number" ? maxItemsRaw : undefined;
    if (maxItems !== undefined && value.length > maxItems) {
      return { valid: false, error: `${path.join(".") || "value"} allows at most ${maxItems} items` };
    }

    const itemsSchema = asObject(resolved.items);
    if (Object.keys(itemsSchema).length > 0) {
      for (let index = 0; index < value.length; index += 1) {
        const result = validateNode(value[index], itemsSchema, [...path, `[${index}]`]);
        if (!result.valid) return result;
      }
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const objectValue = asObject(value);
    const properties = asObject(resolved.properties);
    const required = asArray(resolved.required)
      .map((item) => asString(item).trim())
      .filter(Boolean);

    for (const field of required) {
      if (objectValue[field] === undefined || objectValue[field] === null || asString(objectValue[field]).trim() === "") {
        return { valid: false, error: `${toPath(path, field)} is required` };
      }
    }

    const additionalProperties = resolved.additionalProperties;
    if (additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          return { valid: false, error: `${toPath(path, key)} is not allowed` };
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(objectValue, key)) continue;
      const result = validateNode(objectValue[key], asObject(childSchema), [...path, key]);
      if (!result.valid) return result;
    }
  }

  return { valid: true };
}

export function validateMiniAppDefinitionAgainstSchema(payload: unknown): ValidationResult {
  const result = validateNode(payload, rootSchema, []);
  if (result.valid) return result;
  return {
    valid: false,
    error: result.error || "definition does not match miniapp schema",
  };
}

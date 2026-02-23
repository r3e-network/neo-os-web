export type ContractInitSchemaField = {
  key: string;
  label: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "integer" | "boolean";
  enumValues: string[];
  defaultValue?: unknown;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function parseJSONObjectText(input: string, fieldName: string): Record<string, unknown> {
  const source = String(input || "").trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${fieldName} parse error: ${detail}`);
  }
}

export function extractContractInitSchemaFields(schemaSource: string): {
  fields: ContractInitSchemaField[];
  error: string;
} {
  const source = asString(schemaSource);
  if (!source) return { fields: [], error: "" };

  try {
    const schema = parseJSONObjectText(source, "contract_template_init_schema_json");
    const properties = asObject(schema.properties);
    const requiredSet = new Set(parseStringArray(schema.required));

    const fields = Object.entries(properties).map(([key, rawValue]) => {
      const property = asObject(rawValue);
      const typeRaw = asString(property.type).toLowerCase();
      const type: ContractInitSchemaField["type"] =
        typeRaw === "number" || typeRaw === "integer" || typeRaw === "boolean" ? typeRaw : "string";
      return {
        key,
        label: asString(property.title) || key,
        description: asString(property.description),
        required: requiredSet.has(key),
        type,
        enumValues: parseStringArray(property.enum),
        defaultValue: property.default,
      };
    });

    return {
      fields,
      error: "",
    };
  } catch (error) {
    return {
      fields: [],
      error: error instanceof Error ? error.message : "Invalid contract init schema JSON",
    };
  }
}

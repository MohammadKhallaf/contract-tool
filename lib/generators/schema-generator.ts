import type { GeneratedType, GeneratedSchema } from "@/types";
import { isUnquotedEnum } from "./schema-utils";

function typeToYup(tsType: string): string {
  const trimmed = tsType.trim();
  // Quoted string union enum: "active" | "inactive"
  if (/^["']/.test(trimmed) || trimmed.includes('" | "') || trimmed.includes("' | '")) {
    const values = trimmed.match(/"([^"]+)"|'([^']+)'/g);
    if (values && values.length > 0) return `yup.mixed().oneOf([${values.join(", ")}])`;
  }
  // Unquoted pipe-separated enum: active | inactive | pending | in progress
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|").map((s) => s.trim());
    if (isUnquotedEnum(parts)) {
      return `yup.mixed().oneOf([${parts.map((v) => `"${v}"`).join(", ")}])`;
    }
  }
  const t = trimmed.toLowerCase();
  if (t === "string") return "yup.string()";
  if (t === "number" || t === "integer") return "yup.number()";
  if (t === "boolean") return "yup.boolean()";
  if (t.endsWith("[]") || t.startsWith("array")) return "yup.array()";
  return "yup.mixed()";
}

function parseInterfaceFields(code: string): { name: string; type: string; optional: boolean }[] {
  const fields: { name: string; type: string; optional: boolean }[] = [];
  const lines = code.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s+(\w+)(\?)?:\s*(.+?);?\s*$/);
    if (match) {
      fields.push({
        name: match[1],
        type: match[3].trim(),
        optional: Boolean(match[2]),
      });
    }
  }
  return fields;
}

export function generateSchemas(
  types: GeneratedType[],
  existing: GeneratedSchema[]
): GeneratedSchema[] {
  const result: GeneratedSchema[] = [];

  for (const type of types) {
    if (type.name === "PaginatedResponse") continue; // skip generic

    const schemaName = `${type.name.replace(/^(Get|Create|Update|Patch|Delete)/, "")}Schema`;
    const existingSchema = existing.find((s) => s.linkedTypeId === type.id);

    if (existingSchema?.isEdited) {
      result.push(existingSchema);
      continue;
    }

    const fields = parseInterfaceFields(type.code);
    if (fields.length === 0) {
      // Skip — no real fields (empty request, comment-only stub, type alias target)
      continue;
    }

    const fieldLines = fields
      .filter((f) => !f.name.startsWith("//"))
      .map((f) => {
        const isNullable = f.type.includes("null");
        const baseType = isNullable ? f.type.replace(/\s*\|\s*null/g, "").trim() : f.type;
        const yupType = typeToYup(baseType);
        const base = isNullable ? `${yupType}.nullable()` : yupType;
        const chain = f.optional ? base : `${base}.required()`;
        return `  ${f.name}: ${chain},`;
      });

    const code = `export const ${schemaName} = yup.object({\n${fieldLines.join("\n")}\n}).required();`;

    result.push({
      id: existingSchema?.id ?? crypto.randomUUID(),
      name: schemaName,
      code,
      linkedTypeId: type.id,
      isEdited: false,
    });
  }

  // Deduplicate by name and id
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  return result.filter((s) => {
    if (seenNames.has(s.name) || seenIds.has(s.id)) return false;
    seenNames.add(s.name);
    seenIds.add(s.id);
    return true;
  });
}

import type { GeneratedType, GeneratedSchema } from "@/types";

function typeToYup(tsType: string): string {
  const t = tsType.toLowerCase().trim();
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
      result.push({
        id: existingSchema?.id ?? crypto.randomUUID(),
        name: schemaName,
        code: `export const ${schemaName} = yup.object({\n  // TODO: define schema\n}).required();`,
        linkedTypeId: type.id,
        isEdited: false,
      });
      continue;
    }

    const fieldLines = fields
      .filter((f) => !f.name.startsWith("//"))
      .map((f) => {
        const yupType = typeToYup(f.type);
        const chain = f.optional ? `${yupType}` : `${yupType}.required()`;
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

  return result;
}

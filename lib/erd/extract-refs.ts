export function extractRefs(
  code: string,
  typeName: string,
  allTypeNames: string[]
): string[] {
  return allTypeNames.filter(
    (name) => name !== typeName && new RegExp(`\\b${name}\\b`).test(code)
  );
}

export interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
}

export function parseFields(code: string): ParsedField[] {
  const fields: ParsedField[] = [];
  // Match lines like:   fieldName?: SomeType;  or  fieldName: SomeType;
  const fieldRegex = /^\s{1,4}(\w+)(\?)?\s*:\s*([^;]+);/gm;
  let match: RegExpExecArray | null;
  while ((match = fieldRegex.exec(code)) !== null) {
    fields.push({
      name: match[1],
      optional: match[2] === "?",
      type: match[3].trim(),
    });
  }
  return fields;
}

/**
 * TOON (Tom's Object-Oriented Notation) converter
 * More compact format than JSON for reducing API payload size
 */

/**
 * Convert JSON to brace-less, comma-delimited TOON:
 * key,<value> for primitives
 * key,          (no value) for nested objects/arrays; children are indented
 * arrays render as key, then children lines prefixed with "- "
 */
export function jsonToToon(obj: any, indent = ""): string {
  const next = indent + "  ";

  const renderValue = (value: any, valueIndent: string): string => {
    if (value === null) return "null";
    if (typeof value === "number" || typeof value === "boolean")
      return String(value);
    if (typeof value === "string") {
      // quote only if needed
      if (/[,\n"]/.test(value) || /^\s|\s$/.test(value)) {
        return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      }
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      const items = value
        .map((item) => {
          if (item !== null && typeof item === "object") {
            return `${valueIndent}-\n${jsonToToon(item, valueIndent + "  ")}`;
          }
          return `${valueIndent}- ${renderValue(item, valueIndent + "  ")}`;
        })
        .join("\n");
      return `\n${items}`;
    }
    // object
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return `\n${jsonToToon(value, valueIndent)}`;
  };

  const lines: string[] = [];
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item !== null && typeof item === "object") {
        lines.push(`${indent}-`);
        lines.push(jsonToToon(item, indent + "  "));
      } else {
        lines.push(`${indent}- ${renderValue(item, indent + "  ")}`);
      }
    }
    return lines.join("\n");
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${indent}${key},`);
      lines.push(jsonToToon(value, next));
    } else if (Array.isArray(value)) {
      lines.push(`${indent}${key},${renderValue(value, next)}`);
    } else {
      lines.push(`${indent}${key},${renderValue(value, next)}`);
    }
  }

  return lines.join("\n");
}

/**
 * Parse brace-less, comma-delimited TOON back to JSON.
 */
export function toonToJson(toon: string): any {
  const lines = toon.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error("Empty TOON content");

  type Frame = { type: "object" | "array"; indent: number; value: any };
  const root: Frame = { type: "object", indent: -1, value: {} };
  const stack: Frame[] = [root];

  const parseValue = (raw: string): any => {
    const t = raw.trim();
    if (t === "null") return null;
    if (t === "true") return true;
    if (t === "false") return false;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) return Number(t);
    if (t.startsWith('"') && t.endsWith('"')) {
      return t
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    return t;
  };

  const pushObject = (indent: number) => {
    const obj = {};
    stack.push({ type: "object", indent, value: obj });
    return obj;
  };

  const pushArray = (indent: number) => {
    const arr: any[] = [];
    stack.push({ type: "array", indent, value: arr });
    return arr;
  };

  for (const rawLine of lines) {
    const indent = rawLine.length - rawLine.trimStart().length;
    let line = rawLine.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    if (line.startsWith("-")) {
      const itemText = line.slice(1).trim();
      let item: any;
      if (itemText === "") {
        item = pushObject(indent + 1);
      } else {
        item = parseValue(itemText);
      }
      if (current.type !== "array") {
        // convert current to array if not already
        const newArr: any[] = [];
        if (current.type === "object") {
          // cannot append anonymous items to object; treat as array fallback
          current.value = newArr;
          current.type = "array";
        }
      }
      (current.value as any[]).push(item);
      continue;
    }

    const commaIdx = line.indexOf(",");
    if (commaIdx === -1) {
      // fallback: treat as value line
      if (current.type === "array") {
        (current.value as any[]).push(parseValue(line));
      }
      continue;
    }

    const key = line.slice(0, commaIdx).trim();
    const rest = line.slice(commaIdx + 1);
    const hasValue = rest.trim().length > 0;

    if (current.type !== "object") {
      // promote to object if needed
      const obj = {};
      const parent = stack[stack.length - 2];
      if (parent?.type === "array") {
        parent.value[parent.value.length - 1] = obj;
        current.type = "object";
        current.value = obj;
      }
    }

    if (hasValue) {
      const val = parseValue(rest);
      (current.value as any)[key] = val;
    } else {
      // nested structure
      const obj = pushObject(indent + 1);
      (current.value as any)[key] = obj;
    }
  }

  return root.value;
}

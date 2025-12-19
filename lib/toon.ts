/**
 * TOON (Tom's Object-Oriented Notation) converter
 * More compact format than JSON for reducing API payload size
 */

/**
 * Convert JSON object to TOON format
 */
export function jsonToToon(obj: any, indent: string = ""): string {
  if (obj === null) {
    return "null";
  }

  if (typeof obj === "string") {
    // Escape quotes and newlines
    return `"${obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return "[]";
    }
    const items = obj.map((item) => `${indent}  ${jsonToToon(item, indent + "  ")}`).join("\n");
    return `[\n${items}\n${indent}]`;
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return "{}";
    }
    const items = keys
      .map((key) => {
        const value = jsonToToon(obj[key], indent + "  ");
        return `${indent}${key}: ${value}`;
      })
      .join("\n");
    return `{\n${items}\n${indent}}`;
  }

  return String(obj);
}

/**
 * Convert TOON format back to JSON object
 * Simplified parser that handles the basic TOON format
 */
export function toonToJson(toon: string): any {
  toon = toon.trim();
  if (!toon) {
    throw new Error("Empty TOON content");
  }

  // Handle primitive values
  if (toon === "null") return null;
  if (toon === "true") return true;
  if (toon === "false") return false;
  
  // Handle numbers
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(toon)) {
    return Number(toon);
  }

  // Handle quoted strings
  if (toon.startsWith('"') && toon.endsWith('"')) {
    return toon.slice(1, -1)
      .replace(/\\\\/g, "\\")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n");
  }

  // Handle arrays (TOON format with brackets)
  if (toon.startsWith("[") && toon.endsWith("]")) {
    const content = toon.slice(1, -1).trim();
    if (!content) return [];
    
    const items: any[] = [];
    const lines = content.split("\n");
    let currentItem = "";
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed && !currentItem) continue;

      // Remove indentation
      const dedented = trimmed.replace(/^  +/, "");
      
      for (const char of dedented) {
        if (escapeNext) {
          currentItem += char;
          escapeNext = false;
          continue;
        }
        if (char === "\\") {
          escapeNext = true;
          currentItem += char;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          currentItem += char;
          continue;
        }
        if (inString) {
          currentItem += char;
          continue;
        }
        if (char === "[" || char === "{") {
          depth++;
          currentItem += char;
          continue;
        }
        if (char === "]" || char === "}") {
          depth--;
          currentItem += char;
          continue;
        }
        currentItem += char;
      }

      // If depth is 0 and we have content, it's a complete item
      if (depth === 0 && currentItem.trim()) {
        items.push(toonToJson(currentItem.trim()));
        currentItem = "";
      } else if (depth > 0) {
        currentItem += "\n" + dedented;
      }
    }
    
    if (currentItem.trim()) {
      items.push(toonToJson(currentItem.trim()));
    }
    
    return items;
  }

  // Handle objects (TOON format without braces, just key: value)
  const lines = toon.split("\n");
  if (lines.length === 1 && !toon.includes(":")) {
    // Single value, try JSON fallback
    try {
      return JSON.parse(toon);
    } catch {
      throw new Error(`Invalid TOON format: ${toon.substring(0, 100)}`);
    }
  }

  // Parse as object with key: value pairs
  const obj: any = {};
  let currentKey: string | null = null;
  let currentValue = "";
  let valueIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Calculate indentation level
    const indent = line.length - line.trimStart().length;
    
    // Check if this line has a colon (key: value)
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0 && (valueIndent === -1 || indent <= valueIndent)) {
      // Save previous key-value
      if (currentKey !== null && currentValue.trim()) {
        obj[currentKey] = toonToJson(currentValue.trim());
      }
      
      // Start new key-value
      currentKey = trimmed.slice(0, colonIndex).trim();
      const valuePart = trimmed.slice(colonIndex + 1).trim();
      
      if (valuePart) {
        // Value on same line
        currentValue = valuePart;
        valueIndent = indent;
      } else {
        // Value on next lines
        currentValue = "";
        valueIndent = indent + 2; // Next level of indentation
      }
    } else if (currentKey !== null && indent >= valueIndent) {
      // Continuation of current value
      if (currentValue) {
        currentValue += "\n" + trimmed;
      } else {
        currentValue = trimmed;
      }
    }
  }

  // Save last key-value
  if (currentKey !== null && currentValue.trim()) {
    obj[currentKey] = toonToJson(currentValue.trim());
  }

  return Object.keys(obj).length > 0 ? obj : (() => {
    // Fallback: try JSON
    try {
      return JSON.parse(toon);
    } catch {
      throw new Error(`Invalid TOON format: ${toon.substring(0, 100)}`);
    }
  })();
}

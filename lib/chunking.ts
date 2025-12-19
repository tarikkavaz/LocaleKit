/**
 * JSON chunking utilities for splitting large JSON files into smaller pieces
 * to avoid webview timeout limitations
 */

export interface Chunk {
  key: string; // Top-level key or array index range
  data: any;
  size: number; // Approximate size in bytes
}

/**
 * Split a JSON object into chunks based on size limit
 * Splits at top level only for simplicity and reliability
 */
export function chunkJson(
  jsonObj: any,
  maxChunkSizeBytes: number = 27000, // ~27KB per chunk after TOON size reduction
  excludedPaths: string[] = []
): Chunk[] {
  const chunks: Chunk[] = [];

  // Helper to check if a path should be excluded (exact match only)
  // Using subkey matches here would wrongly drop entire parent objects (e.g., "ui.jackpots" would skip "ui").
  function isExcluded(key: string): boolean {
    return excludedPaths.some((excluded) => excluded === key);
  }

  // Helper to get approximate size of a value
  function getSize(value: any): number {
    return new Blob([JSON.stringify(value)]).size;
  }

  // Handle arrays - split into sub-arrays
  if (Array.isArray(jsonObj)) {
    if (jsonObj.length === 0) {
      return [{ key: "array", data: [], size: 0 }];
    }

    let currentChunk: any[] = [];
    let currentSize = 0;
    let startIndex = 0;

    for (let i = 0; i < jsonObj.length; i++) {
      const item = jsonObj[i];
      const itemSize = getSize(item);
      const itemKey = `[${i}]`;

      if (isExcluded(itemKey)) {
        // Excluded item - save current chunk if exists
        if (currentChunk.length > 0) {
          chunks.push({
            key: `[${startIndex}-${i - 1}]`,
            data: currentChunk,
            size: currentSize,
          });
          currentChunk = [];
          currentSize = 0;
          startIndex = i + 1;
        }
        continue;
      }

      // If adding this item would exceed limit, save current chunk
      if (
        currentSize + itemSize > maxChunkSizeBytes &&
        currentChunk.length > 0
      ) {
        chunks.push({
          key: `[${startIndex}-${i - 1}]`,
          data: currentChunk,
          size: currentSize,
        });
        currentChunk = [];
        currentSize = 0;
        startIndex = i;
      }

      currentChunk.push(item);
      currentSize += itemSize;
    }

    // Add remaining items
    if (currentChunk.length > 0) {
      chunks.push({
        key: `[${startIndex}-${jsonObj.length - 1}]`,
        data: currentChunk,
        size: currentSize,
      });
    }

    return chunks;
  }

  // Handle objects - split by top-level keys
  if (typeof jsonObj === "object" && jsonObj !== null) {
    const keys = Object.keys(jsonObj);
    let currentChunk: any = {};
    let currentSize = 0;
    const chunkKeys: string[] = [];

    for (const key of keys) {
      if (isExcluded(key)) {
        // Excluded key - save current chunk if exists
        if (Object.keys(currentChunk).length > 0) {
          chunks.push({
            key: chunkKeys.join(","),
            data: currentChunk,
            size: currentSize,
          });
          currentChunk = {};
          currentSize = 0;
          chunkKeys.length = 0;
        }
        continue;
      }

      const value = jsonObj[key];
      const valueSize = getSize(value);

      // If this single value is too large, it needs to be split further
      // For now, we'll include it and let the API handle it (or it will timeout)
      // In the future, we could recursively chunk large values

      // If adding this key would exceed limit, save current chunk
      if (
        currentSize + valueSize > maxChunkSizeBytes &&
        Object.keys(currentChunk).length > 0
      ) {
        chunks.push({
          key: chunkKeys.join(","),
          data: currentChunk,
          size: currentSize,
        });
        currentChunk = {};
        currentSize = 0;
        chunkKeys.length = 0;
      }

      currentChunk[key] = value;
      chunkKeys.push(key);
      currentSize += valueSize;
    }

    // Add remaining keys
    if (Object.keys(currentChunk).length > 0) {
      chunks.push({
        key: chunkKeys.join(","),
        data: currentChunk,
        size: currentSize,
      });
    }

    return chunks;
  }

  // Primitive value - single chunk
  return [{ key: "value", data: jsonObj, size: getSize(jsonObj) }];
}

/**
 * Merge translated chunks back into a single JSON object
 */
export function mergeChunks(
  chunks: Array<{ key: string; data: any }>,
  originalStructure: any
): any {
  // Start with a deep copy of the original structure to preserve excluded paths
  const result = JSON.parse(JSON.stringify(originalStructure));

  // Handle array chunks
  if (Array.isArray(originalStructure)) {
    for (const chunk of chunks) {
      const key = chunk.key;
      const data = chunk.data;

      // Parse array range like "[0-5]"
      const match = key.match(/^\[(\d+)(?:-(\d+))?\]$/);
      if (match) {
        const startIndex = parseInt(match[1], 10);
        const endIndex = match[2] ? parseInt(match[2], 10) : startIndex;

        if (Array.isArray(data)) {
          for (let i = 0; i < data.length && startIndex + i <= endIndex; i++) {
            result[startIndex + i] = data[i];
          }
        } else {
          result[startIndex] = data;
        }
      }
    }
    return result;
  }

  // Handle object chunks
  if (typeof originalStructure === "object" && originalStructure !== null) {
    for (const chunk of chunks) {
      const keys = chunk.key.split(",");
      const data = chunk.data;

      // Merge each key from the chunk
      for (const key of keys) {
        const trimmedKey = key.trim();
        if (trimmedKey && data[trimmedKey] !== undefined) {
          // Preserve excluded paths from original
          if (originalStructure[trimmedKey] !== undefined) {
            result[trimmedKey] = data[trimmedKey];
          }
        }
      }
    }
    return result;
  }

  // Primitive value - return first chunk's data
  return chunks.length > 0 ? chunks[0].data : originalStructure;
}

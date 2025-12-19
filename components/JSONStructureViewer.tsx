"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { ChevronDown, ChevronRight, CheckSquare, Square } from "lucide-react";

interface JSONNode {
  path: string;
  value: any;
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  children?: JSONNode[];
}

interface JSONStructureViewerProps {
  jsonData: any;
  excludedPaths: string[];
  onExcludedPathsChange: (paths: string[]) => void;
}

export default function JSONStructureViewer({
  jsonData,
  excludedPaths,
  onExcludedPathsChange,
}: JSONStructureViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Convert JSON to tree structure
  const buildNodeTree = (obj: any, path: string = ""): JSONNode[] => {
    if (obj === null) {
      return [{ path, value: null, type: "null" }];
    }

    if (Array.isArray(obj)) {
      return [
        {
          path,
          value: obj,
          type: "array",
          children: obj.flatMap((item, index) =>
            buildNodeTree(item, path ? `${path}[${index}]` : `[${index}]`)
          ),
        },
      ];
    }

    if (typeof obj === "object") {
      const children: JSONNode[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const childPath = path ? `${path}.${key}` : key;
        const valueType =
          value === null
            ? "null"
            : Array.isArray(value)
            ? "array"
            : typeof value === "object"
            ? "object"
            : (typeof value as "string" | "number" | "boolean");

        if (valueType === "object" || valueType === "array") {
          children.push({
            path: childPath,
            value,
            type: valueType,
            children: buildNodeTree(value, childPath),
          });
        } else {
          children.push({
            path: childPath,
            value,
            type: valueType,
          });
        }
      }
      return children;
    }

    return [{ path, value: obj, type: typeof obj as "string" | "number" | "boolean" }];
  };

  const nodes = buildNodeTree(jsonData);

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const toggleExcluded = (path: string) => {
    const newExcluded = [...excludedPaths];
    const index = newExcluded.indexOf(path);
    if (index >= 0) {
      newExcluded.splice(index, 1);
    } else {
      newExcluded.push(path);
    }
    onExcludedPathsChange(newExcluded);
  };

  const isExcluded = (path: string): boolean => {
    return excludedPaths.includes(path);
  };

  const isExpanded = (path: string): boolean => {
    return expandedPaths.has(path);
  };

  const renderNode = (node: JSONNode, depth: number = 0): ReactElement => {
    const hasChildren = node.children && node.children.length > 0;
    const excluded = isExcluded(node.path);
    const expanded = isExpanded(node.path);

    const getValuePreview = (value: any, type: string): string => {
      if (type === "null") return "null";
      if (type === "string") {
        const str = String(value);
        return str.length > 50 ? str.substring(0, 50) + "..." : str;
      }
      if (type === "array") return `[${(value as any[]).length} items]`;
      if (type === "object") return `{${Object.keys(value).length} keys}`;
      return String(value);
    };

    return (
      <div key={node.path} className="select-none">
        <div
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-foreground/5 transition-colors ${
            excluded ? "opacity-60" : ""
          }`}
          style={{ paddingLeft: `${depth * 1.5}rem` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(node.path)}
              className="p-1 hover:bg-foreground/10 rounded transition-colors"
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-foreground/60" />
              ) : (
                <ChevronRight className="w-4 h-4 text-foreground/60" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <button
            onClick={() => toggleExcluded(node.path)}
            className="p-1 hover:bg-foreground/10 rounded transition-colors"
          >
            {excluded ? (
              <CheckSquare className="w-4 h-4 text-foreground/60" />
            ) : (
              <Square className="w-4 h-4 text-foreground/40" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-foreground/80 font-medium">
                {node.path.split(".").pop() || node.path}
              </span>
              <span className="text-xs text-foreground/40 px-1.5 py-0.5 bg-foreground/5 rounded">
                {node.type}
              </span>
            </div>
            {!hasChildren && (
              <div className="text-xs text-foreground/60 mt-0.5 truncate">
                {getValuePreview(node.value, node.type)}
              </div>
            )}
            {hasChildren && (
              <div className="text-xs text-foreground/40 mt-0.5">
                {node.type === "array"
                  ? `${(node.value as any[]).length} items`
                  : `${Object.keys(node.value).length} keys`}
              </div>
            )}
          </div>
        </div>

        {hasChildren && expanded && (
          <div className="ml-4 border-l border-border/30">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">JSON Structure</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              // Select all leaf nodes
              const allPaths: string[] = [];
              const collectPaths = (nodes: JSONNode[]) => {
                nodes.forEach((node) => {
                  if (!node.children || node.children.length === 0) {
                    allPaths.push(node.path);
                  } else if (node.children) {
                    collectPaths(node.children);
                  }
                });
              };
              collectPaths(nodes);
              onExcludedPathsChange(allPaths);
            }}
            className="text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Exclude All
          </button>
          <button
            onClick={() => onExcludedPathsChange([])}
            className="text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Include All
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 max-h-96 overflow-y-auto">
        {nodes.length === 0 ? (
          <p className="text-sm text-foreground/60 text-center py-4">No JSON data</p>
        ) : (
          <div className="space-y-1">
            {nodes.map((node) => renderNode(node))}
          </div>
        )}
      </div>

      {excludedPaths.length > 0 && (
        <div className="text-xs text-foreground/60">
          {excludedPaths.length} node{excludedPaths.length !== 1 ? "s" : ""} excluded from translation
        </div>
      )}
    </div>
  );
}

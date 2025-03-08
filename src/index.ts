import path from "node:path";
import { parse } from "@babel/parser";
import { traverse } from "@babel/core";
import {
  isJSXIdentifier,
  isJSXMemberExpression,
  type JSXIdentifier,
  type JSXMemberExpression,
  type JSXNamespacedName,
} from "@babel/types";
import MagicString from "magic-string";

export function reactComponentTagger({
  exclude = [],
  extensions = [".jsx", ".tsx"],
}: { exclude?: string[]; extensions?: string[] } = {}) {
  const cwd = process.cwd();
  return {
    name: "vite-plugin-react-component-tagger",
    enforce: "pre",
    async transform(code: string, id: string) {
      if (
        id.includes("node_modules") ||
        !extensions.includes(path.extname(id))
      ) {
        return;
      }
      const filename = path.basename(id);
      const filepath = path.relative(cwd, id);
      try {
        const ast = parse(code, {
          sourceType: "module",
          plugins: ["jsx", "typescript"],
        });
        const magic = new MagicString(code);
        traverse(ast, {
          JSXOpeningElement({ node, parent }) {
            const name = getComponentName(node.name);
            const start = `${parent.loc?.start.line ?? 0}:${
              parent.loc?.start.column ?? 0
            }:${parent.loc?.start.index ?? 0}`;
            const end = `${parent.loc?.end.line ?? 0}:${
              parent.loc?.end.column ?? 0
            }:${parent.loc?.end.index ?? 0}`;
            const open = {
              start: `${node.loc?.start.line ?? 0}:${
                node.loc?.start.column ?? 0
              }:${node.loc?.start.index ?? 0}`,
              end: `${node.loc?.end.line ?? 0}:${node.loc?.end.column ?? 0}:${
                node.loc?.end.index ?? 0
              }`,
            };
            if (exclude.includes(name)) {
              return;
            }
            magic.appendLeft(
              node.name.end ?? 0,
              ` data-component-start="${start}" data-component-end="${end}" data-component-opening-start="${open.start}" data-component-opening-end="${open.end}" data-component-path="${filepath}" data-component-file="${filename}" data-component-name="${name}"`,
            );
          },
        });
        return {
          code: magic.toString(),
          map: magic.generateMap({ hires: true }),
        };
      } catch (e) {
        console.error(`Error processing file ${filepath}:`, e);
        return null;
      }
    },
  };
}

function getComponentName(
  name: JSXIdentifier | JSXMemberExpression | JSXNamespacedName,
): string {
  return isJSXIdentifier(name)
    ? name.name
    : isJSXMemberExpression(name)
      ? `${getComponentName(name.object)}.${getComponentName(
          name.property as JSXIdentifier,
        )}`
      : "";
}

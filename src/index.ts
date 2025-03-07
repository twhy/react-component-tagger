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
						const start = parent.start ?? 0;
						const end = parent.end ?? 0;
						const index = `${start}:${end}`;
						const line = node.loc?.start?.line ?? 0;
						const column = node.loc?.start?.column ?? 0;
						const name = getComponentName(node.name);
						if (exclude.includes(name)) {
							return;
						}
						magic.appendLeft(
							node.name.end ?? 0,
							` data-component-index="${index}" data-component-path="${filepath}" data-component-file="${filename}" data-component-name="${name}" data-component-line="${line}" data-component-column="${column}"`,
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

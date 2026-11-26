import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

process.env.NEXT_PUBLIC_USE_MOCKS = "false";

const storageFunctions = new Set(["readStore", "writeStore", "changeStore"]);

function contains(node: ts.Node, target: ts.Node): boolean {
  if (node === target) return true;
  return node.getChildren().some((child) => contains(child, target));
}

function isMocksCondition(node: ts.Expression, positive: boolean): boolean {
  if (ts.isIdentifier(node) && node.text === "USE_MOCKS") return positive;
  return (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(node.operand) &&
    node.operand.text === "USE_MOCKS" &&
    !positive
  );
}

function terminates(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) {
    const last = statement.statements.at(-1);
    return !!last && terminates(last);
  }
  return (
    ts.isIfStatement(statement) &&
    !!statement.elseStatement &&
    terminates(statement.thenStatement) &&
    terminates(statement.elseStatement)
  );
}

function isMockGuarded(call: ts.CallExpression): boolean {
  let node: ts.Node = call;
  while (node.parent) {
    const parent = node.parent;
    if (
      ts.isIfStatement(parent) &&
      ((isMocksCondition(parent.expression, true) &&
        contains(parent.thenStatement, call)) ||
        (isMocksCondition(parent.expression, false) &&
          !!parent.elseStatement &&
          contains(parent.elseStatement, call)))
    ) {
      return true;
    }
    if (
      ts.isConditionalExpression(parent) &&
      ((isMocksCondition(parent.condition, true) &&
        contains(parent.whenTrue, call)) ||
        (isMocksCondition(parent.condition, false) &&
          contains(parent.whenFalse, call)))
    ) {
      return true;
    }
    if (
      ts.isBinaryExpression(parent) &&
      parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      isMocksCondition(parent.left, true) &&
      contains(parent.right, call)
    ) {
      return true;
    }
    if (ts.isBlock(parent)) {
      const currentIndex = parent.statements.findIndex((statement) =>
        contains(statement, call),
      );
      for (let index = 0; index < currentIndex; index += 1) {
        const previous = parent.statements[index];
        if (
          ts.isIfStatement(previous) &&
          isMocksCondition(previous.expression, false) &&
          terminates(previous.thenStatement)
        ) {
          return true;
        }
      }
    }
    node = parent;
  }
  return false;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    if (
      !/\.(tsx?|mts|cts)$/.test(entry.name) ||
      /\.test\.[^.]+$/.test(entry.name) ||
      entry.name === "demo-store.ts"
    ) {
      return [];
    }
    return [fullPath];
  });
}

test("production mode never reaches demo-store calls outside mock guards", () => {
  assert.equal(process.env.NEXT_PUBLIC_USE_MOCKS, "false");
  const violations: string[] = [];

  for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
    const text = readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : "";
        if (storageFunctions.has(name) && !isMockGuarded(node)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          violations.push(`${path.relative(process.cwd(), file)}:${line + 1} ${name}()`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  assert.deepEqual(violations, [], violations.join("\n"));
});

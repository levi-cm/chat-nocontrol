import { describe, expect, it } from "vitest";
import ts from "typescript-eslint-compiler";
import checksumSource from "../../protocol/checksum.ts?raw";

const comparison =
  "difference |= (left[index] as number) ^ (right[index] as number);";

function inspectEqualBytes(source: string) {
  const sourceFile = ts.createSourceFile(
    "checksum.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const equalBytes = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "equalBytes",
  );
  const returns: ts.ReturnStatement[] = [];
  const loops: ts.ForStatement[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isReturnStatement(node)) returns.push(node);
    if (ts.isForStatement(node)) loops.push(node);
    ts.forEachChild(node, visit);
  };
  if (equalBytes?.body) visit(equalBytes.body);

  const loopControlFlow: ts.Node[] = [];
  const visitLoop = (node: ts.Node): void => {
    if (
      ts.isIfStatement(node) ||
      ts.isBreakStatement(node) ||
      ts.isContinueStatement(node) ||
      ts.isReturnStatement(node)
    ) {
      loopControlFlow.push(node);
    }
    ts.forEachChild(node, visitLoop);
  };
  if (loops[0]) visitLoop(loops[0].statement);

  return { equalBytes, loops, loopControlFlow, returns, sourceFile };
}

describe("equalBytes constant-time shape", () => {
  it("has no data-dependent control flow inside its byte loop", () => {
    const { equalBytes, loops, loopControlFlow, returns, sourceFile } =
      inspectEqualBytes(checksumSource);
    expect(equalBytes?.body).toBeDefined();
    expect(loops).toHaveLength(1);
    expect(returns).toHaveLength(2);
    expect(loops[0]?.statement.getText(sourceFile)).toContain("difference |=");
    expect(loops[0]?.statement.getText(sourceFile)).toContain("^");
    expect(loopControlFlow).toEqual([]);
    expect(returns.at(-1)?.expression?.getText(sourceFile)).toBe(
      "difference === 0",
    );
  });

  it.each([
    ["if", `if (left[index] === right[index]) { ${comparison} }`],
    ["break", `if (left[index] === right[index]) break;\n    ${comparison}`],
    [
      "continue",
      `if (left[index] === right[index]) continue;\n    ${comparison}`,
    ],
    [
      "return",
      `if (left[index] === right[index]) return true;\n    ${comparison}`,
    ],
  ])("rejects a comparison-loop %s mutation", (_label, mutation) => {
    const mutated = checksumSource.replace(comparison, mutation);
    expect(mutated).not.toBe(checksumSource);
    expect(inspectEqualBytes(mutated).loopControlFlow).not.toEqual([]);
  });
});

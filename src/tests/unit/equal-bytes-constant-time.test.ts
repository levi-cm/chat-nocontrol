import { describe, expect, it } from "vitest";
import ts from "typescript-eslint-compiler";
import checksumSource from "../../protocol/checksum.ts?raw";

describe("equalBytes constant-time shape", () => {
  it("has no data-dependent return inside its byte loop", () => {
    const sourceFile = ts.createSourceFile(
      "checksum.ts",
      checksumSource,
      ts.ScriptTarget.Latest,
      true,
    );
    const equalBytes = sourceFile.statements.find(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === "equalBytes",
    );
    expect(equalBytes?.body).toBeDefined();

    const returns: ts.ReturnStatement[] = [];
    const loops: ts.ForStatement[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isReturnStatement(node)) returns.push(node);
      if (ts.isForStatement(node)) loops.push(node);
      ts.forEachChild(node, visit);
    };
    visit(equalBytes?.body as ts.Block);

    expect(loops).toHaveLength(1);
    expect(returns).toHaveLength(2);
    expect(loops[0]?.statement.getText(sourceFile)).toContain("difference |=");
    expect(loops[0]?.statement.getText(sourceFile)).toContain("^");
    expect(
      returns.some((statement) => {
        let parent: ts.Node | undefined = statement.parent;
        while (parent && parent !== equalBytes?.body) {
          if (ts.isIterationStatement(parent, false)) return true;
          parent = parent.parent;
        }
        return false;
      }),
    ).toBe(false);
    expect(returns.at(-1)?.expression?.getText(sourceFile)).toBe(
      "difference === 0",
    );
  });
});

const Module = require("node:module");

const originalLoad = Module._load;

Module._load = function loadWithCompatibleTypeScript(request, parent, isMain) {
  if (request === "typescript") {
    return originalLoad.call(
      this,
      "typescript-eslint-compiler",
      parent,
      isMain,
    );
  }
  if (request.startsWith("typescript/")) {
    return originalLoad.call(
      this,
      request.replace("typescript/", "typescript-eslint-compiler/"),
      parent,
      isMain,
    );
  }
  return originalLoad.call(this, request, parent, isMain);
};

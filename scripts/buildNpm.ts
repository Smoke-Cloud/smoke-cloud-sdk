import { build, emptyDir } from "jsr:@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./src/api.ts"],
  outDir: "./npm",
  shims: {
    deno: true,
    // undici: true,
    // blob: true,
  },
  importMap: "deno.json",
  rootTestDir: "./src/tests",
  package: {
    name: "smoke-cloud-sdk",
    version: Deno.args[0],
    description: "A SDK form working with the Smoke Cloud API.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/Smoke-Cloud/smoke-cloud-sdk.git",
    },
    bugs: {
      url: "https://github.com/Smoke-Cloud/smoke-cloud-sdk/issues",
    },
    devDependencies: {
      "@types/uuid": "^9.0.1",
      "@types/crypto-js": "^4.2.0",
    },
    engines: {
      node: ">=18.16.0",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    // Deno.copyFileSync("LICENSE", "npm/LICENSE");
    // Deno.copyFileSync("README.md", "npm/README.md");
  },
  compilerOptions: {
    lib: ["ES2023", "DOM"],
    target: "ES2022",
  },
});

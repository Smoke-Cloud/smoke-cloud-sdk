import { bundle } from "jsr:@deno/emit";
{
  const url = new URL("../src/api.ts", import.meta.url);
  const result = await bundle(url, {
    importMap: {
      imports: {
        "jose": "https://esm.sh/jose@5.2.0",
        "@microsoft/microsoft-graph-client":
          "https://cdn.jsdelivr.net/npm/@microsoft/microsoft-graph-client/lib/graph-js-sdk.js",
        "@azure/msal-browser": "https://esm.sh/@azure/msal-browser",
      },
    },
    type: "module",
    allowRemote: true,
    compilerOptions: {
      sourceMap: true,
    },
  });
  await Deno.mkdir("browser", { recursive: true });
  await Deno.writeTextFile("browser/api.js", result.code);
  if (result.map) {
    await Deno.writeTextFile("browser/api.js.map", result.map);
  }
}

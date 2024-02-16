import { bundle } from "https://deno.land/x/emit@0.33.0/mod.ts";
{
  const url = new URL("../src/api.ts", import.meta.url);
  const result = await bundle(url, {
    importMap: new URL("../esm.json", import.meta.url),
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

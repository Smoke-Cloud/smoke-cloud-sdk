import { assert } from "@std/assert";
import { isJsonApiErrorResponse } from "./utils.ts";

Deno.test("valid error reponse", () => {
  const example = {
    "errors": [{
      "code": "Other",
      "title": "Model already running with that CHID",
      "message": "Model already running with that CHID",
    }],
  };
  assert(isJsonApiErrorResponse(example));
});

// import { delay } from "jsr:@std/async";

// Deno.test("async test", async () => {
//   const x = 1 + 2;
//   await delay(100);
//   assertEquals(x, 3);
// });

// Deno.test({
//   name: "read file test",
//   fn: () => {
//     const data = Deno.readTextFileSync("./somefile.txt");
//     assertEquals(data, "expected content");
//   },
// });

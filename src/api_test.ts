import { isJsonApiErrorResponse } from "./utils.ts";
import { test } from "node:test";
import assert from "node:assert";

test("valid error reponse", () => {
  const example = {
    errors: [
      {
        code: "Other",
        title: "Model already running with that CHID",
        message: "Model already running with that CHID",
      },
    ],
  };
  assert(isJsonApiErrorResponse(example));
});

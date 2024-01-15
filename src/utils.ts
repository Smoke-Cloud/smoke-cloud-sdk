import type { ScJsonApiError } from "./apiTypes.ts";

export class ApiError extends Error {}

export type ScApiReponse = (ScApiDataResponse | ScApiErrorResponse) & {
  meta?: Record<string, unknown>;
};

export interface ScApiDataResponse {
  data: object;
}

export interface ScApiErrorResponse {
  errors: ScJsonApiError[];
}

export function isJsonApiErrorResponse(
  err: unknown,
): err is ScApiErrorResponse {
  if (err === null) return false;
  if (typeof err !== "object") return false;
  if (!("errors" in err)) return false;
  if (!(err.errors instanceof Array)) return false;
  for (const errObj of err.errors) {
    if (!isJsonApiError(errObj)) return false;
  }
  return true;
}

export function isJsonApiError(err: unknown): err is ScJsonApiError {
  if (err === null) return false;
  if (typeof err !== "object") return false;
  if (!("code" in err)) return false;
  if (typeof err.code !== "string") return false;
  return true;
}

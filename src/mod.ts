/**
 * SDK for access to the Smoke Cloud simulation and modelling platform.
 *
 * @example
 * ```ts
 * import { search } from "@luca/search";
 *
 * const client: ApiClient = new ApiClient(auth);
 * await client.init();
 * for await (const run of await client.runs()) {
 *    console.log(run);
 * }
 * ```
 *
 * @module smokecloud
 */

export type {
  CurrentUsage,
  InstanceType,
  NCores,
  Phase,
  PresenceProgressFull,
  ProgressInfo,
  PublicRunningStatus,
  RunBilling,
  RunId,
  Snapshot,
} from "./coreTypes.ts";
export type { AuthProvider } from "./authProviders/mod.ts";
export type { DataVector, RunData } from "./getS3CSVData.ts";
export { Progress, Run } from "./runs.ts";
export * from "./coreTypes.ts";
export * from "./getS3CSVData.ts";
export * from "./authProviders/mod.ts";
export * from "./api.ts";

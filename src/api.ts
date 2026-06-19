import type {
  CurrentUsage,
  InstanceType,
  NCores,
  OrgLogos,
  Phase,
  ProgressInfo,
  PublicRunningStatus,
  RunBilling,
  RunEntry,
  RunId,
  RunTimes,
  Snapshot,
  UserInfo,
} from "./coreTypes.ts";
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
import { coresToInstance } from "./coreTypes.ts";
export type { DataVector, RunData } from "./getS3CSVData.ts";
import type { DataVector, RunData } from "./getS3CSVData.ts";
import type { AuthProvider } from "./authProviders/mod.ts";
import { Run } from "./runs.ts";
import { isJsonApiErrorResponse, type ScApiErrorResponse } from "./utils.ts";
export { Progress, Run } from "./runs.ts";
export * from "./coreTypes.ts";
export * from "./getS3CSVData.ts";
export * from "./authProviders/mod.ts";

export interface RunFilter {
  /** unix time in milliseconds */
  updatedSince?: number;
  chid?: string;
}

export class ApiClient {
  public api_endpoint: URL = new URL("https://api.smokecloud.io/v5");
  public storage_endpoint: URL = new URL("https://store01.smokecloud.io/v3");
  #accountId?: string;
  private initialized: boolean = false;
  private authProvider: AuthProvider | null;
  private initProgress?: Promise<void>;
  constructor(
    authProvider: AuthProvider | null,
    options?: {
      api_endpoint?: string;
      storage_endpoint?: string;
    },
  ) {
    this.authProvider = authProvider;
    if (options?.api_endpoint) {
      this.api_endpoint = new URL(options.api_endpoint);
    }
    if (options?.storage_endpoint) {
      this.storage_endpoint = new URL(options.storage_endpoint);
    }
  }

  public async init() {
    await this.authProvider?.init();
    this.initialized = true;
  }

  private async ensureInit() {
    if (this.initProgress) return await this.initProgress;
    else {
      this.initProgress = this.init();
      await this.initProgress;
    }
  }

  async request(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.authProvider?.acquireToken();
    const params = init ? init : {};
    const headers: Headers = new Headers(init?.headers);
    headers.append("Content-Type", "application/json");
    headers.append("Access-Control-Request-Headers", "Location");
    if (token) {
      headers.append("Authorization", `Bearer ${token}`);
    }
    params.headers = headers;
    if (path.length !== 0 && !path.startsWith("/")) {
      path = `/${path}`;
    }
    const url = new URL(`${this.api_endpoint}${path}`);
    const request = new Request(`${url}`, params);
    try {
      return await fetch(request, {
        "credentials": "include",
        // "mode": "same-origin",
      });
    } catch (e) {
      console.warn(`Failed: apiRequest[${params.method}]: ${url}`);
      throw e;
    }
  }

  async requestStorage(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.authProvider?.acquireToken();
    const params = init ? init : {};
    const headers: Headers = new Headers(init?.headers);
    headers.append("Content-Type", "application/json");
    headers.append("Access-Control-Request-Headers", "Location");
    if (token) {
      headers.append("Authorization", `Bearer ${token}`);
    }
    params.headers = headers;
    if (path.length !== 0 && !path.startsWith("/")) {
      path = `/${path}`;
    }
    const url = new URL(`${this.storage_endpoint}${path}`);
    const request = new Request(`${url}`, params);
    try {
      return await fetch(request);
    } catch (e) {
      console.warn(`Failed: apiRequest[${params.method}]: ${url}`);
      throw e;
    }
  }

  private async processError(response: Response): Promise<Error> {
    let errorResponse: ScApiErrorResponse | undefined;
    const errorResponseText: string = await response.text();
    try {
      errorResponse = JSON.parse(errorResponseText);
      if (isJsonApiErrorResponse(errorResponse)) {
        return new Error(errorResponse.errors.at(0)?.code ?? "UnknownError", {
          cause: errorResponse,
        });
      } else {
        return new Error(
          `${response.status}: ${response.statusText}: ${errorResponse}`,
        );
      }
    } catch {
      const errMsg = errorResponse
        ? errorResponse.errors
          ? JSON.stringify(errorResponse.errors)
          : JSON.stringify(errorResponse)
        : errorResponseText;
      return new Error(`${response.status}: ${response.statusText}: ${errMsg}`);
    }
  }

  // Unwrap JSONAPI responses
  private async processResponseJsonApi<T>(response: Response): Promise<T> {
    if (response.ok) {
      // const contentType = response.headers.get("Content-Type")?.toLowerCase();
      // TODO: assert: (contentType === "application/json" || contentType === "application/vnd.api+json") {
      const t = (await response.json()) as { data: T };
      return t.data;
    } else {
      throw await this.processError(response);
    }
  }

  private async processResponseBody(
    response: Response,
  ): Promise<ReadableStream<Uint8Array> | null> {
    if (response.ok) {
      return (await response.body) as ReadableStream<Uint8Array> | null;
    } else {
      throw await this.processError(response);
    }
  }

  private async processResponseText(response: Response): Promise<string> {
    if (response.ok) {
      return await response.text();
    } else {
      throw await this.processError(response);
    }
  }

  public async accountId(): Promise<string> {
    return await this.getAccountId();
  }

  // TODO: could we have multiple organizations?
  private async getAccountId(): Promise<string> {
    if (this.#accountId) return this.#accountId;
    const resp = await this.request("/me", { method: "GET" });
    if (resp.ok) {
      const user = (await this.processResponseJsonApi(resp)) as {
        account_id: string;
        username?: string;
        id?: string;
      };
      this.#accountId = user.account_id;
      return user.account_id;
    } else {
      throw await this.processError(resp);
    }
  }

  public async runs(
    filter?: RunFilter & { limit?: number },
  ): Promise<RunEntryIter> {
    if (!this.initialized) {
      await this.init();
    }
    return new RunEntryIter(this, await this.getAccountId(), filter);
  }

  public async latestRun(filter?: RunFilter): Promise<Run | undefined> {
    let latest: Run | undefined;
    for await (const run of await this.runs(filter)) {
      if (
        !latest ||
        (latest.openTime && run.openTime && latest.openTime < run.openTime)
      ) {
        latest = run;
      }
    }
    return latest;
  }

  public async status(): Promise<PublicRunningStatus[]> {
    const path = `/orgs/${await this.getAccountId()}/running_status`;
    const resp = await this.request(path);
    return await this.processResponseJsonApi(resp);
  }

  public async run(runId: RunId): Promise<RunEntry> {
    const path = `/runs/${runId}`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async times(runId: RunId): Promise<RunTimes> {
    const path = `/runs/${runId}/times`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async progress(runId: RunId): Promise<ProgressInfo> {
    const path = `/runs/${runId}/progress`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async confirmClosed(runId: RunId): Promise<boolean> {
    let open = true;
    let nErrors = 0;
    while (open) {
      try {
        const run = await this.run(runId);
        open = !run.close_time;
        await new Promise((resolve) => setTimeout(resolve, 20 * 1000));
      } catch (e) {
        nErrors++;
        if (nErrors > 50) {
          throw e;
        }
      }
    }
    return !open;
  }

  public async snapshots(runId: RunId): Promise<Snapshot[]> {
    const path = `/runs/${runId}/snapshots`;
    const resp = await this.requestStorage(path);
    return resp.json();
  }

  public async latestSnapshot(runId: RunId): Promise<Snapshot | undefined> {
    const snapshots = await this.snapshots(runId);
    let latest: Snapshot | undefined;
    for (const snapshot of snapshots) {
      if (!latest || latest.time < snapshot.time) {
        latest = snapshot;
      }
    }
    return latest;
  }

  public async snapshotContents(
    runId: RunId,
    snapshotId: string,
  ): Promise<string[]> {
    const path = `/runs/${runId}/snapshots/${snapshotId}/contents`;
    const resp = await this.requestStorage(path);
    return resp.json();
  }

  public async snapshotFile(
    runId: RunId,
    snapshotId: string,
    p: string,
  ): Promise<ReadableStream<Uint8Array> | null> {
    const path = `/runs/${runId}/snapshots/${snapshotId}/contents/${p}`;
    const resp = await this.requestStorage(path);
    return this.processResponseBody(resp);
  }

  public async errText(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<string> {
    return (await this._err(runId, location, opts)).text();
  }

  public async err(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<Blob> {
    return (await this._err(runId, location, opts)).blob();
  }
  public async _err(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<Response> {
    return await this._file(runId, location, "err", opts);
  }

  public async inputText(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<string> {
    return (await this._input(runId, location, opts)).text();
  }

  public async input(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<Blob> {
    return (await this._input(runId, location, opts)).blob();
  }
  public async _input(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<Response> {
    return await this._file(runId, location, "input", opts);
  }

  public async outputText(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<string> {
    return (await this._output(runId, location, opts)).text();
  }

  public async output(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<Blob> {
    return (await this._output(runId, location, opts)).blob();
  }
  public async _output(
    runId: RunId,
    location: "storage" | "running",
    opts?: { range?: string },
  ): Promise<Response> {
    return await this._file(runId, location, "out", opts);
  }

  public async _file(
    runId: RunId,
    location: "storage" | "running",
    file: string,
    opts?: { range?: string },
  ): Promise<Response> {
    const path = `/runs/${runId}/${file}?phase=${location}`;
    const headers = new Headers();
    if (opts?.range) {
      headers.set("Range", opts?.range);
    }
    const resp = await this.request(path, {
      headers,
    });
    return resp;
  }

  public async zip(runId: RunId): Promise<ReadableStream<Uint8Array> | null> {
    const path = `/runs/${runId}/zip`;
    const resp = await this.requestStorage(path);
    return this.processResponseBody(resp);
  }

  public async memLog(runId: RunId): Promise<DataVector<Date, number> | null> {
    const path = `/runs/${runId}/log/mem`;
    const resp = await this.request(path);
    const vector: DataVector<Date, number> | null = await this
      .processResponseJsonApi(resp);
    if (!vector) return null;
    vector.values = vector.values.map((p) => ({
      x: new Date(p.x),
      y: p.y,
    }));
    return vector;
  }

  public async cpuLog(runId: RunId): Promise<DataVector<Date, number> | null> {
    const path = `/runs/${runId}/log/cpu`;
    const resp = await this.request(path);
    const vector: DataVector<Date, number> | null = await this
      .processResponseJsonApi(resp);
    if (!vector) return null;
    vector.values = vector.values.map((p) => ({
      x: new Date(p.x),
      y: p.y,
    }));
    return vector;
  }

  public async diskLog(runId: RunId): Promise<DataVector<Date, number> | null> {
    const path = `/runs/${runId}/log/disk`;
    const resp = await this.request(path);
    const vector: DataVector<Date, number> | null = await this
      .processResponseJsonApi(resp);
    if (!vector) return null;
    vector.values = vector.values.map((p) => ({
      x: new Date(p.x),
      y: p.y,
    }));
    return vector;
  }

  public async data(
    runId: string,
    location: Phase,
    csvtype: string,
    value: string,
  ): Promise<DataVector<number, number>> {
    const queryParams = new URLSearchParams({
      phase: location,
      csvtype,
      value,
    });
    const path = `/runs/${runId}/data${
      queryParams.size > 0 ? `?${queryParams.toString()}` : ""
    }`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  /**
   * @brief Get the run data of a run.
   *
   * @param runId The id of the run.
   * @param location Optional: The phase of the run. If not specified defaults
   * to the latest phase.
   *
   * @returns The @see {@link RunData} of the run. If the selected phase (or no
   * phase when phase is not specified) is not present but the run exists, null
   * is returned.
   *
   * @throws If there is no such run.
   */
  public async runData(runId: string, location?: Phase): Promise<RunData> {
    let path = `/runs/${runId}/data/run`;
    if (location) {
      path += `?phase=${location}`;
    }
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async newRun(
    startParams: SubmitStartParams,
    input: BodyInit,
  ): Promise<RunEntry> {
    if (!startParams.chid || startParams.chid.length === 0) {
      throw new Error("no CHID provided");
    }
    const instanceType = typeof startParams.instance_type === "number"
      ? coresToInstance(startParams.instance_type)
      : startParams.instance_type;
    const params: Record<string, string> = {
      chid: startParams.chid,
      fds_version: startParams.fds_version,
      instance_type: instanceType,
    };
    if (startParams.placement) {
      params.placement = startParams.placement;
    }
    if (startParams.project) {
      params.project = startParams.project;
    }
    params.apply_mpi_transform = true.toString();
    const queryParams = new URLSearchParams(params);
    const path = `/orgs/${await this.getAccountId()}/runs${
      queryParams.size > 0 ? `?${queryParams.toString()}` : ""
    }`;
    // Post the submission info.
    const resp = await this.request(path, {
      headers: new Headers({
        // TODO: this is not actually used currently
        "Idempotency-Key": crypto.randomUUID(),
        "Content-Type": "application/octet-stream",
      }),
      body: input,
      method: "POST",
    });
    if (!resp.ok && resp.status === 409) {
      // There was a conflict, this means either it failed due to the
      // idempotency key or there is already an open model. Not sure we
      // particularly need to special-case this
      const err = await resp.json();
      throw new Error(err);
    } else {
      return this.processResponseJsonApi(resp);
    }
  }

  public async load(): Promise<CurrentUsage> {
    const path = `/orgs/${await this.getAccountId()}/load`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async outstanding(accountIdOverride?: string): Promise<RunBilling[]> {
    const accountId = accountIdOverride ?? await this.getAccountId();
    const path = `/orgs/${accountId}/billing/outstanding`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async outstandingTotal(): Promise<{
    currency: string;
    total: number;
  }> {
    const path = `/orgs/${await this.getAccountId()}/billing/outstanding/total`;
    const resp = await this.request(path);
    const total = (await this.processResponseJsonApi(resp)) as [string, number];
    return { currency: total[0].toUpperCase(), total: total[1] };
  }

  public async couponsTotal(): Promise<{ currency: string; total: number }> {
    const path = `/orgs/${await this.getAccountId()}/billing/coupons`;
    const resp = await this.request(path);
    const total = (await this.processResponseJsonApi(resp)) as [string, number];
    return { currency: total[0].toUpperCase(), total: total[1] };
  }

  public async me(): Promise<UserInfo> {
    const path = "/me";
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async org(): Promise<OrgLogos | undefined> {
    const resp = await this.request("/me/logos");
    return this.processResponseJsonApi(resp);
  }
  follow(runId: string): ReadableStream<Uint8Array> {
    const follower = new Follower(this, runId);
    // Feature test as ReadableStream.from is not currently available on all
    // platforms
    if ("from" in ReadableStream && typeof ReadableStream.from === "function") {
      return ReadableStream.from(follower);
    } else {
      return readableStreamFromAsyncIterator(follower[Symbol.asyncIterator]());
    }
  }
  async stop(runId: string): Promise<string> {
    const resp = await this.request(`/runs/${runId}/stop`, { method: "PUT" });
    return this.processResponseText(resp);
  }
  async kill(runId: string): Promise<string> {
    const resp = await this.request(`/runs/${runId}/kill`, { method: "PUT" });
    return this.processResponseText(resp);
  }
}

class Follower implements AsyncIterable<Uint8Array> {
  private closed = false;
  private nRead = 0;
  public client: ApiClient;
  public runId: RunId;
  constructor(client: ApiClient, runId: RunId) {
    this.client = client;
    this.runId = runId;
  }
  async *[Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array> {
    while (!this.closed) {
      // TODO: would be better to get the --follow option working on the server
      await new Promise((resolve) => setTimeout(resolve, 2 * 1000));
      const run = await this.client.run(this.runId);
      this.closed = Boolean(run.close_time);
      // TODO: the server should be able to handle this element of phase
      const phase = closed ? "storage" : "running";
      const s = await this.client.err(this.runId, phase, {
        range: `bytes=${this.nRead}-`,
      });
      if (!s) break;
      if (s.slice(this.nRead).size) {
        yield new Uint8Array(await s.slice(this.nRead).arrayBuffer());
        this.nRead += s.slice(this.nRead).size;
      }
    }
  }
}

export interface PagedResponse<T> {
  data: T[];
  links?: {
    next?: string;
  };
}

// TODO: add support for more filter options
export class RunEntryIter implements AsyncIterable<Run> {
  private nextUrl?: string;
  private client: ApiClient;
  constructor(
    client: ApiClient,
    accountId: string,
    filter?: RunFilter & { limit?: number },
  ) {
    this.client = client;
    const params = new URLSearchParams();
    if (filter?.updatedSince != undefined) {
      params.set("from_time", filter?.updatedSince.toString());
    }
    if (filter?.chid) {
      params.set("chid", filter?.chid);
    }
    if (filter?.limit != undefined) {
      params.set("limit", filter?.limit.toString());
    }
    if (params.size > 0) {
      this.nextUrl = `/orgs/${accountId}/runs?${params.toString()}`;
    } else {
      this.nextUrl = `/orgs/${accountId}/runs`;
    }
  }
  async *[Symbol.asyncIterator](): AsyncIterableIterator<Run> {
    while (1) {
      if (this.nextUrl) {
        const resp = await this.client.request(this.nextUrl);
        if (resp.ok) {
          const result: PagedResponse<RunEntry> =
            (await resp.json()) as PagedResponse<RunEntry>;
          console.log(result.links);
          for (const r of result.data) {
            yield new Run(r);
          }
          if (result.links?.next) {
            this.nextUrl = result.links.next;
          } else {
            break;
          }
        } else {
          const err = await resp.json();
          throw new Error(err);
        }
      }
    }
  }
}

export interface SubmitStartParams {
  project?: string;
  chid: string;
  fds_version: string;
  instance_type: NCores | InstanceType;
  placement?: "cloud";
}

export interface UploadProgressResult {
  id: string;
  status: UploadStatus;
}

export type UploadStatus = "running" | "completed" | "failed";

// TODO: this is a polyfill and should be removed when possible.
function readableStreamFromAsyncIterator<T>(
  iterator: AsyncIterableIterator<T>,
): ReadableStream<T> {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
  });
}

export const fdsVersions = [
  "5.5.3",
  "6.1.2",
  "6.2.0",
  "6.3.0",
  "6.3.1",
  "6.3.2",
  "6.4.0",
  "6.5.0",
  "6.5.1",
  "6.5.2",
  "6.5.3",
  "6.6.0",
  "6.7.0",
  "6.7.1",
  "6.7.3",
  "6.7.4",
  "6.7.5",
  "6.7.6",
  "6.7.7",
  "6.7.8",
  "6.7.9",
  "6.8.0",
  "6.9.0",
  "6.9.1",
  "6.10.0",
  "6.10.1",
];

import * as uuid from "npm:uuid";
import {
  coresToInstance,
  type CurrentUsage,
  InstanceType,
  NCores,
  Phase,
  ProgressInfo,
  PublicRunningStatus,
  RunBilling,
  RunEntry,
  RunId,
  Snapshot,
  User,
} from "./coreTypes.ts";
import { UserOrgInfo } from "./credentials.ts";
import { DataVector, RunData } from "./getS3CSVData.ts";
import { AuthProvider } from "./authProviders/mod.ts";
export * from "./credentials.ts";
export * from "./coreTypes.ts";
export * from "./getS3CSVData.ts";
export * from "./authProviders/mod.ts";

export class ApiError extends Error {}
export interface ScApiErrorResponse {
  errors: ScApiErrorObject[];
}
export interface ScApiErrorObject {
  id?: string;
  links?: { about?: string; type?: string };
  status?: string;
  code: string;
  title?: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
    header?: string;
  };
  meta?: object;
}

export interface RunFilter {
  /// unix time in milliseconds
  updatedSince?: number;
  chid?: string;
}

export class ApiClient {
  public api_endpoint = new URL("https://api.smokecloud.io/v3");
  public storage_endpoint = new URL("https://store01.smokecloud.io/v3");
  public accountId?: string;
  constructor(private authProvider: AuthProvider, options?: {
    api_endpoint?: string;
    storage_endpoint?: string;
  }) {
    if (options?.api_endpoint) {
      this.api_endpoint = new URL(options.api_endpoint);
    }
    if (options?.storage_endpoint) {
      this.storage_endpoint = new URL(options.storage_endpoint);
    }
  }

  public async init() {
    await this.authProvider.init();
    this.accountId = await this.getAccountId();
  }

  async request(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.authProvider.acquireToken();
    const params = init ? init : {};
    const headers: Headers = new Headers(init?.headers);
    headers.append("Content-Type", "application/json");
    headers.append("Access-Control-Request-Headers", "Location");
    headers.append(
      "Authorization",
      `Bearer ${token}`,
    );
    params.headers = headers;
    if (path.length !== 0 && !path.startsWith("/")) {
      path = `/${path}`;
    }
    const url = new URL(`${this.api_endpoint}${path}`);
    const request = new Request(`${url}`, params);
    try {
      return await fetch(request);
    } catch (e) {
      console.warn(`Failed: apiRequest[${params.method}]: ${url}`);
      throw e;
    }
  }

  async requestStorage(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.authProvider.acquireToken();
    const params = init ? init : {};
    const headers: Headers = new Headers(init?.headers);
    headers.append("Content-Type", "application/json");
    headers.append("Access-Control-Request-Headers", "Location");
    headers.append(
      "Authorization",
      `Bearer ${token}`,
    );
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
    const errorResponseText: string = await response
      .text();
    try {
      errorResponse = JSON.parse(
        errorResponseText,
      ) as ScApiErrorResponse;
    } catch {
      // pass
    }
    // return new Error(JSON.stringify(errorResponse.errors))
    const errMsg = errorResponse
      ? (errorResponse.errors
        ? JSON.stringify(errorResponse.errors)
        : JSON.stringify(errorResponse))
      : errorResponseText;
    return new Error(
      `${response.status}: ${response.statusText}: ${errMsg}`,
    );
  }

  // Unwrap JSONAPI responses
  private async processResponseJsonApi<T>(response: Response): Promise<T> {
    if (response.ok) {
      // const contentType = response.headers.get("Content-Type")?.toLowerCase();
      // TODO: assert: (contentType === "application/json" || contentType === "application/vnd.api+json") {
      const t = await response.json() as { data: T };
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

  // TODO: could we have multiple organizations?
  private async getAccountId(): Promise<string> {
    const resp = await this.request("/me", { method: "GET" });
    if (resp.ok) {
      const user = (await this.processResponseJsonApi(resp)) as {
        account_id: string;
        username?: string;
        id?: string;
      };
      return user.account_id;
    } else {
      throw await this.processError(resp);
    }
  }

  public async runs(
    filter?: RunFilter & { limit?: number },
  ): Promise<RunEntryIter> {
    if (!this.accountId) {
      await this.init();
    }
    return new RunEntryIter(this, filter);
  }

  public async latestRun(filter?: RunFilter): Promise<RunEntry | undefined> {
    let latest: RunEntry | undefined;
    for await (const run of await this.runs(filter)) {
      if (
        !latest || (latest.open_time && run.open_time &&
          (latest.open_time < run.open_time))
      ) {
        latest = run;
      }
    }
    return latest;
  }

  public async status(): Promise<PublicRunningStatus[]> {
    const path = `/orgs/${this.accountId}/running_status`;
    const resp = await this.request(path);
    return await this.processResponseJsonApi(resp);
  }

  public async run(runId: RunId): Promise<RunEntry> {
    const path = `/runs/${runId}`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async progress(runId: RunId): Promise<ProgressInfo> {
    const path = `/runs/${runId}/progress`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async confirmClosed(runId: RunId): Promise<boolean> {
    let run = await this.run(runId);
    while (run.open) {
      run = await this.run(runId);
      await (new Promise((resolve) => setTimeout(resolve, 2 * 1000)));
    }
    return !run.open;
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
    location: Phase.Storage | Phase.Running,
    opts?: { range?: string },
  ): Promise<string> {
    return (await this._err(runId, location, opts)).text();
  }

  public async err(
    runId: RunId,
    location: Phase.Storage | Phase.Running,
    opts?: { range?: string },
  ): Promise<Blob> {
    return (await this._err(runId, location, opts)).blob();
  }
  public async _err(
    runId: RunId,
    location: Phase.Storage | Phase.Running,
    opts?: { range?: string },
  ): Promise<Response> {
    return (await this._file(runId, location, "err", opts));
  }

  public async inputText(
    runId: RunId,
    location: Phase.Storage | Phase.Running,
    opts?: { range?: string },
  ): Promise<string> {
    return (await this._input(runId, location, opts)).text();
  }

  public async input(
    runId: RunId,
    location: Phase.Storage | Phase.Running,
    opts?: { range?: string },
  ): Promise<Blob> {
    return (await this._input(runId, location, opts)).blob();
  }
  public async _input(
    runId: RunId,
    location: Phase.Storage | Phase.Running,
    opts?: { range?: string },
  ): Promise<Response> {
    return (await this._file(runId, location, "input", opts));
  }

  public async _file(
    runId: RunId,
    location: Phase.Storage | Phase.Running,
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

  public async memLog(runId: RunId): Promise<DataVector<Date, number>> {
    const path = `/runs/${runId}/log/mem`;
    const resp = await this.request(path);
    const vector: DataVector<Date, number> = await this
      .processResponseJsonApi(resp);
    vector.values = vector.values.map((p) => ({
      x: new Date(p.x),
      y: p.y,
    }));
    return vector;
  }

  public async cpuLog(runId: RunId): Promise<DataVector<Date, number>> {
    const path = `/runs/${runId}/log/cpu`;
    const resp = await this.request(path);
    const vector: DataVector<Date, number> = await this
      .processResponseJsonApi(resp);
    vector.values = vector.values.map((p) => ({
      x: new Date(p.x),
      y: p.y,
    }));
    return vector;
  }

  public async diskLog(runId: RunId): Promise<DataVector<Date, number>> {
    const path = `/runs/${runId}/log/disk`;
    const resp = await this.request(path);
    const vector: DataVector<Date, number> = await this
      .processResponseJsonApi(resp);
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
    if (startParams.project) {
      params.project = startParams.project;
    }
    params.apply_mpi_transform = true.toString();
    const queryParams = new URLSearchParams(params);
    const path = `/orgs/${this.accountId}/runs${
      queryParams.size > 0 ? `?${queryParams.toString()}` : ""
    }`;
    try {
      // Post the submission info.
      const resp = await this.request(path, {
        headers: new Headers({
          // TODO: this is not actually used currently
          "Idempotency-Key": uuid.v4(),
          "Content-Type": "application/octet-stream",
        }),
        body: input,
        method: "POST",
      });
      if (!resp.ok && resp.status === 409) {
        // There was a conflict, this means either it failed due to the
        // idempotency key or there is already an open model. Not sure we
        // particularly need to special-case this
        const err: any = await resp.json();
        throw new Error(err);
      } else {
        return this.processResponseJsonApi(resp);
      }
    } catch (err) {
      throw err;
    }
  }

  public async load(): Promise<CurrentUsage> {
    const path = `/orgs/${this.accountId}/load`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async outstanding(accountIdOverride?: string): Promise<RunBilling[]> {
    const accountId = accountIdOverride ?? this.accountId;
    const path = `/orgs/${accountId}/billing/outstanding`;
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public async outstandingTotal(): Promise<
    { currency: string; total: number }
  > {
    const path = `/orgs/${this.accountId}/billing/outstanding/total`;
    const resp = await this.request(path);
    const total = (await this.processResponseJsonApi(resp)) as [string, number];
    return { currency: total[0].toUpperCase(), total: total[1] };
  }

  public async couponsTotal(): Promise<
    { currency: string; total: number }
  > {
    const path = `/orgs/${this.accountId}/billing/coupons`;
    const resp = await this.request(path);
    const total = (await this.processResponseJsonApi(resp)) as [string, number];
    return { currency: total[0].toUpperCase(), total: total[1] };
  }

  public async me(): Promise<User> {
    const path = "/me";
    const resp = await this.request(path);
    return this.processResponseJsonApi(resp);
  }

  public org(): Promise<UserOrgInfo | undefined> {
    return this.authProvider.org();
  }
  follow(runId: string): ReadableStream<Uint8Array> {
    const follower = new Follower(this, runId);
    // TODO: ReadableStream.from is not widely available enough yet
    // return ReadableStream.from(follower);
    return readableStreamFromAsyncIterator(follower[Symbol.asyncIterator]());
  }
  async stop(runId: string) {
    const resp = await this.request(`/runs/${runId}/stop`, { method: "PUT" });
    return this.processResponseText(resp);
  }
  async kill(runId: string) {
    const resp = await this.request(`/runs/${runId}/kill`, { method: "PUT" });
    return this.processResponseText(resp);
  }
}

class Follower implements AsyncIterable<Uint8Array> {
  private closed = false;
  private nRead = 0;
  constructor(private client: ApiClient, public runId: RunId) {
  }
  async *[Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array> {
    while (!this.closed) {
      // TODO: would be better to get the --follow option working on the server
      await (new Promise((resolve) => setTimeout(resolve, 2 * 1000)));
      const run = await this.client.run(this.runId);
      this.closed = !run.open;
      // TODO: the server should be able to handle this element of phase
      const phase = closed ? Phase.Storage : Phase.Running;
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
export class RunEntryIter implements AsyncIterable<RunEntry> {
  private nextUrl?: string;
  constructor(
    private client: ApiClient,
    filter?: RunFilter & { limit?: number },
  ) {
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
      this.nextUrl = `/orgs/${this.client.accountId}/runs?${params.toString()}`;
    } else {
      this.nextUrl = `/orgs/${this.client.accountId}/runs`;
    }
  }
  async *[Symbol.asyncIterator](): AsyncIterableIterator<RunEntry> {
    while (1) {
      if (this.nextUrl) {
        const resp = await this.client.request(this.nextUrl);
        if (resp.ok) {
          const result: PagedResponse<RunEntry> = await resp
            .json() as PagedResponse<RunEntry>;
          for (const r of result.data) {
            yield r;
          }
          if (result.links?.next) {
            this.nextUrl = result.links.next;
          } else {
            break;
          }
        } else {
          const err: any = await resp.json();
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
}

export interface UploadProgressResult {
  id: string;
  status: UploadStatus;
}

export enum UploadStatus {
  Running = "running",
  Completed = "completed",
  Failed = "failed",
}

export function toTable(runs: PublicRunningStatus[]) {
  return runs.map(toTableRun);
}

export function toTableRun(run: PublicRunningStatus) {
  const runRate = run.run_rate !== undefined
    ? `${(run.run_rate * 60 * 60 * 24).toFixed(2)} s/day`
    : "-";
  const cpu = run.cpu?.Value !== undefined && run.cpu_max?.Value !== undefined
    ? `${run.cpu.Value.toFixed(0)}/${run.cpu_max.Value.toFixed(0)}%`
    : "-";
  const memory =
    run.memory?.Value !== undefined && run.memory_max?.Value !== undefined
      ? `${(run.memory.Value / 1024 / 1024 / 1024).toFixed(2)}/${
        (run.memory_max.Value / 1024 / 1024 / 1024).toFixed(2)
      } GiB`
      : "-";
  return {
    run_id: run.run_id,
    account_id: run.account_id,
    chid: run.chid,
    cpu,
    memory,
    runRate,
  };
}

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

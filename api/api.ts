import * as uuid from "uuid";
import { type CurrentUsage, RunEntry, RunId, coresToInstance, NCores, InstanceType, Phase, ProgressInfo, PublicRunningStatus, User } from "./coreTypes.ts";
import { UserOrgInfo } from "./credentials.ts";
import { DataVector, RunData } from "./getS3CSVData.ts";
import { AuthProvider } from "./authProviders/mod.ts";
export * from "./credentials.ts";
export * from "./coreTypes.ts";
export * from "./getS3CSVData.ts";
export * from "./authProviders/mod.ts";
export class ApiError extends Error { }

export interface ScApiErrorResponse {
  errors: ScApiErrorObject[];
}

export interface ScApiErrorObject {
  id?: string;
  links?: {
    about?: string;
    type?: string;
  };
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
  private stage = "v3";
  public api_endpoint = new URL("https://api.smokecloud.io");
  public accountId?: string;
  constructor(private authProvider: AuthProvider, options?: {
    stage?: string,
    api_endpoint?: string
  }) {
    if (options?.stage) {
      this.stage = options.stage;
    }
    if (options?.api_endpoint) {
      this.api_endpoint = new URL(options.api_endpoint);
    }
  }

  public async init() {
    this.accountId = await this.getAccountId();
  }

  async request(path: string, init?: RequestInit) {
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
    url.pathname = `/${this.stage}${url.pathname}`;
    const request = new Request(`${url}`, params);
    try {
      const response = await fetch(request);
      return response;
    } catch (e) {
      console.warn(`Failed: apiRequest[${params.method}]: ${url}`);
      throw e;
    }
  }

  // TODO: could we have multiple organizations?
  private async getAccountId(): Promise<string> {
    const resp = await this.request("/me/account_id", { method: "GET" });
    if (resp.ok) {
      const accountId = await resp.json();
      return accountId;
    } else {
      const errMsg = await resp.text();
      console.error(errMsg);
      throw new Error(errMsg);

    }
  }

  public runs(filter?: RunFilter & { limit?: number }): RunEntryIter {
    return new RunEntryIter(this, filter);
  }

  public async status(): Promise<PublicRunningStatus[]> {
    const path = `/orgs/${this.accountId}/running_status`;
    const resp = await this.request(path);
    if (resp.ok) {
      return (await resp.json()).data;
    } else {
      throw new Error((await resp.text()))
      // throw new Error((await resp.json()).error)
    }
  }

  public async run(runId: RunId): Promise<RunEntry> {
    const path = `/runs/${runId}`;
    const resp = await this.request(path);
    if (resp.ok) {
      return (await resp.json()).data;
    } else {
      throw new Error((await resp.json()).error)
    }
  }

  public async progress(runId: RunId): Promise<ProgressInfo> {
    const path = `/runs/${runId}/progress`;
    const resp = await this.request(path);
    if (resp.ok) {
      return (await resp.json()).data;
    } else {
      throw new Error((await resp.json()).error)
    }
  }

  public async confirmClosed(runId: RunId): Promise<boolean> {
    let run = await this.run(runId);
    while (run.open) {
      run = await this.run(runId);
      await (new Promise((resolve) => setTimeout(resolve, 2 * 1000)));
    }
    return !run.open;
  }

  public async err(runId: RunId, location: Phase.Storage | Phase.Running, opts?: { range?: string }): Promise<string> {
    const path = `/runs/${runId}/err?phase=${location}`;
    const headers = new Headers();
    if (opts?.range) {
      headers.set("Range", opts?.range)
    }
    const resp = await this.request(path, {
      headers
    });
    return resp.text();
  }

  public async errBytes(runId: RunId, location: Phase.Storage | Phase.Running, opts?: { range?: string }): Promise<Blob> {
    const path = `/runs/${runId}/err?phase=${location}`;
    const headers = new Headers();
    if (opts?.range) {
      headers.set("Range", opts?.range)
    }
    const resp = await this.request(path, {
      headers
    });
    return resp.blob();
  }

  public async input(runId: RunId, location: Phase.Storage | Phase.Running, opts?: { range?: string }): Promise<string> {
    const path = `/runs/${runId}/input?phase=${location}`;
    const headers = new Headers();
    if (opts?.range) {
      headers.set("Range", opts?.range)
    }
    const resp = await this.request(path, {
      headers
    });
    return resp.text();
  }

  public async zip(runId: RunId): Promise<ReadableStream<Uint8Array> | null> {
    const path = `/runs/${runId}/zip`;
    const resp = await this.request(path);
    return resp.body;
  }


  public async data(runId: string, location: Phase, csvtype: string, value: string): Promise<DataVector<number, number>> {
    const queryParams = new URLSearchParams({
      phase: location,
      csvtype,
      value
    });
    const path = `/runs/${runId}/data${queryParams.size > 0 ? `?${queryParams.toString()}` : ""}`;
    const resp = await this.request(path);
    const r = await resp.json();
    return r.data;
  }


  public async runData(runId: string): Promise<RunData> {
    const path = `/runs/${runId}/data/run`;
    const resp = await this.request(path);
    const r = await resp.json();
    return r.data;
  }

  public async newRun(startParams: SubmitStartParams, input: ReadableStream<Uint8Array> | string): Promise<RunEntry> {
    if (!startParams.chid || startParams.chid.length === 0) {
      throw new Error("no CHID provided");
    }
    const instanceType = typeof startParams.instance_type === "number" ? coresToInstance(startParams.instance_type) : startParams.instance_type;
    const params: Record<string, string> = {
      chid: startParams.chid,
      fds_version: startParams.fds_version,
      instance_type: instanceType
    }
    if (startParams.project) {
      params.project = startParams.project;
    }
    const queryParams = new URLSearchParams(params);
    const path = `/orgs/${this.accountId}/runs${queryParams.size > 0 ? `?${queryParams.toString()}` : ""}`;
    try {
      // Post the submission info.
      const resp = await this.request(path, {
        headers: new Headers({
          // TODO: this is not actually used currently
          "Idempotency-Key": uuid.v4(),
          "Content-Type": "application/octet-stream"
        }),
        body: input,
        method: "POST"
      });
      if (!resp.ok) {
        if (resp.status === 409) {
          // There was a conflict, this means either it failed due to the
          // idempotency key or there is already an open model.
          throw new Error(await resp.json())
        } else {
          const errMsg = await resp.text();
          console.error(errMsg);
          throw new Error(errMsg)
          // throw new Error(await resp.json())
        }
      }
      return (await resp.json()).data;
    } catch (err) {
      throw err;
    }
  }

  public async load(): Promise<CurrentUsage> {
    const path = `/orgs/${this.accountId}/load`;
    const resp = await this.request(path);
    return (await resp.json()).data;
  }

  public async me(): Promise<User> {
    const path = "/me";
    const resp = await this.request(path);
    return (await resp.json()).data;
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
    const result = await this.request(`/runs/${runId}/stop`, { method: "PUT" });
    return result.text();
  }
  async kill(runId: string) {
    const result = await this.request(`/runs/${runId}/kill`, { method: "PUT" });
    return result.text();
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
      const s = await this.client.errBytes(this.runId, phase, { range: `bytes=${this.nRead}-` });
      if (!s) break;
      if (s.slice(this.nRead).size) {
        yield new Uint8Array(await s.slice(this.nRead).arrayBuffer());
        this.nRead += s.slice(this.nRead).size;
      }
    }
  }
}



export interface PagedResponse<T> {
  data: T[],
  links?: {
    next?: string
  }
}

// TODO: add support for more filter options
export class RunEntryIter implements AsyncIterable<RunEntry> {
  private nextUrl?: string;
  constructor(private client: ApiClient, filter?: RunFilter & { limit?: number }) {
    const params = new URLSearchParams();
    if (filter?.updatedSince) {
      params.set("from_time", filter?.updatedSince.toString());
    }
    if (filter?.chid) {
      params.set("chid", filter?.chid);
    }
    if (filter?.limit) {
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
          const result: PagedResponse<RunEntry> = await resp.json();
          for (const r of result.data) {
            yield r;
          }
          if (result.links?.next) {
            this.nextUrl = result.links.next;
          } else {
            break;
          }
        } else {
          throw new Error(await resp.json());

        }
      }
    }
  }
}

export interface SubmitStartParams {
  project?: string,
  chid: string,
  fds_version: string,
  instance_type: NCores | InstanceType,
}

export interface UploadProgressResult {
  id: string,
  status: UploadStatus,
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
  const runRate = run.run_rate !== undefined ? `${(run.run_rate * 60 * 60 * 24).toFixed(2)} s/day` : "-";
  const cpu = run.cpu?.Value !== undefined && run.cpu_max?.Value !== undefined ? `${(run.cpu.Value).toFixed(0)}/${(run.cpu_max.Value).toFixed(0)}%` : "-";
  const memory = run.memory?.Value !== undefined && run.memory_max?.Value !== undefined ? `${(run.memory.Value / 1024 / 1024 / 1024).toFixed(2)}/${(run.memory_max.Value / 1024 / 1024 / 1024).toFixed(2)} GiB` : "-";
  return {
    run_id: run.run_id,
    account_id: run.account_id,
    chid: run.chid,
    cpu,
    memory,
    runRate,
  }
}

// TODO: this is a polyfill and should be removed when possible.
function readableStreamFromAsyncIterator<T>(iterator: AsyncIterableIterator<T>,): ReadableStream<T> {
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) { controller.close(); } else { controller.enqueue(value); }
    },
  });
}

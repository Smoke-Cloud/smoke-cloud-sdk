export interface CurrentUsage {
  used_cores: number;
  reserved_cores: number;
}

export interface Snapshot {
  id: string;
  time: string;
  size: number;
}

export interface ScError {
  message: string;
  code: string;
}

export type RunId = string;
export type Chid = string;
export type AccountId = string;
export type UploadId = string;

export interface PublicRunningStatus {
  run_id: RunId;
  account_id: AccountId;
  chid: Chid;
  progress?: RawProgress;
  cpu?: {
    Value?: number;
  };
  cpu_max?: {
    Value?: number;
  };
  memory?: {
    Value?: number;
  };
  memory_max?: {
    Value?: number;
  };

  /** Number of seconds simulated per second */
  run_rate?: number;
}

export interface RunEntry {
  run_id: RunId;
  sim_id: { account_id: AccountId; chid: string };
  open_time: string;
  close_time?: string;
  archived?: string;
  update_time?: string;
  username?: string;
  project_id?: string;
  project_number?: string;
  version: number;
  manual_upload: boolean;
  running: PresenceProgress;
  stored: PresenceProgress;
  no_archive: boolean;
  // Present on the backend but not yet consistently returned by every
  // endpoint that yields a RunEntry.
  deprecated?: boolean;
  title?: string;
  run_params?: {
    instance_type: string;
    fds_version: string;
    core_count: number;
    mem_gb: number;
    n_processes?: number;
    n_threads?: number;
  };
}

export interface RunBilling {
  account_id: string;
  run_id: string;
  project?: string;
  user?: string;
  //  instance_type: smoke_cloud_core::InstanceType,
  duration: {
    secs: number;
    nanos: number;
  };
  cost: [string, number];
}

export interface ProgressInfo {
  running: PresenceProgress;
  stored: PresenceProgress;
}

export interface RunTimes {
  duration: number;
  finished: boolean;
}

export type PresenceProgress =
  PresenceProgressFull | PresenceProgressEmpty | PresenceProgressNone;

/** Convert a complex {@link PresenceProgress} to a more basic representation
 * of the current progress of a model. */
export function toSimpleProgress(
  progress: PresenceProgress,
): { current: number; total: number } | undefined {
  if (progress.present && progress.sim && progress.wall) {
    return { current: progress.sim.last_time, total: progress.sim.end_time };
  }
}

export type PresenceProgressFull = RawProgress & { present: true };

export interface RawProgress {
  sim: { start_time: number; end_time: number; last_time: number };
  wall: {
    start_time: string;
    last_time: string;
  };
}

export interface PresenceProgressEmpty {
  present: true;
  sim: undefined;
  wall: undefined;
}

export interface PresenceProgressNone {
  present: false;
}

export interface OpenConfig {
  fds_version: string;
  project_number: string;
  instance_type: InstanceType;
  dry_run: boolean;
  placement?: string;
  user_override?: string;
}

export interface ModelSummary {
  chid: string;
  runs: RunEntry[];
}

/** A number of cores a run can use: 1 to {@link MAX_CORES}. */
export type NCores =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32;

/** The most cores a run can use. */
export const MAX_CORES = 32;

/** The memory a run gets for each of its cores, in GiB. */
export const MEM_GIB_PER_CORE = 4;

/** Whether `n` is a number of cores a run can use: a whole number from 1 to
 * {@link MAX_CORES}. */
export function isCoreCount(n: number): n is NCores {
  return Number.isInteger(n) && n >= 1 && n <= MAX_CORES;
}

/** The available instance names, "Cores1" to "Cores32". */
export type InstanceType = `Cores${NCores}`;

/** Convert a number of cores to an instance name. Throws a RangeError for a
 * number that isn't a whole number from 1 to {@link MAX_CORES}. */
export function coresToInstance(nCores: NCores): InstanceType {
  if (!isCoreCount(nCores)) {
    throw new RangeError(
      `A run can use 1 to ${MAX_CORES} cores, not ${nCores}`,
    );
  }
  return `Cores${nCores}`;
}

/** The different phases of a run. */
export type Phase = "staging" | "storage" | "running";

/** Information on a user. */
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  org: OrgInfo;
}

/** Information on an organization */
export interface OrgInfo {
  id: string;
  name: string;
  account_id: string;
}

/** Urls to the logos associated with an organization. */
export interface OrgLogos {
  light_url?: string;
  dark_url?: string;
}

export type Uuid = string;

export interface FullDistribution {
  key: string;
  name: string;
  org_id: string;
  project: string | null;
  models: DistributionModel[];
  creation_date?: Date;
}

export interface DistributionModel {
  chid: string;
  description: string;
  model_index: number;
  size: number | null;
}

/**
 * A workspace: simulations (whole CHIDs, not individual runs) gathered from
 * any of an org's projects for analysing and reviewing together. Its
 * simulations are those in the projects it includes whole (a simulation is in
 * the project of its most recent run), plus those it includes explicitly,
 * minus those it excludes explicitly. Two workspaces can include the same
 * simulations.
 */
export interface Workspace {
  id: Uuid;
  name: string;
  creation_time: string;
  update_time: string;
}

/** A simulation in a workspace. */
export interface WorkspaceSimulation {
  chid: string;
  /** The project of the simulation's most recent run. */
  project_number: string | null;
  /** Whether the workspace includes it explicitly, rather than through its
   * project. */
  explicit: boolean;
}

/** A workspace, what it includes and excludes, and the simulations that makes
 * up. */
export interface WorkspaceDetails extends Workspace {
  /** Projects included whole. */
  project_numbers: string[];
  /** Simulations included explicitly. */
  included_chids: string[];
  /** Simulations excluded explicitly. */
  excluded_chids: string[];
  /** The simulations in the workspace. */
  simulations: WorkspaceSimulation[];
}

/** A tab open on the console's simulations page: a project or a workspace. */
export interface WorkspaceTab {
  kind: "project" | "workspace";
  id: Uuid;
}

export interface ProjectEntry {
  id: Uuid;
  number: string;
  title?: string | null;
  creation_date: string;
  soft_limit?: number | null;
  hard_limit?: number | null;
}

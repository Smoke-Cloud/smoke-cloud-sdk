export type LoginData = LoginDataMs | LoginDataKeys | LoginDataPassword;
export type LoginResult<T extends LoginData> = LoginSuccess<T> | LoginFailure;
export interface LoginSuccess<T> {
  success: true;
  data: T;
}
export interface LoginDataMs {
  type: "microsoft";
  tokens: TokenResponse;
  account_id: string;
  received: number;
}
export interface LoginDataKeys {
  type: "keys";
  id_key: string;
  secret_key: string;
  customerid: string;
}
export interface LoginDataPassword {
  type: "password";
  username: string;
  password: string;
  account_id: string;
}
export interface LoginFailure {
  success: false;
  error: ScError;
}

export interface CurrentUsage {
  used_cores: number;
  reserved_cores: number;
}
export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface ScError {
  message: string;
  code: string;
}

export type RunId = string;
export type Chid = string;
export type AccountId = string;

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
  open_time?: string;
  update_time?: string;
  username?: string;
  project_number?: string;
  open: boolean;
  version: number;
  manual_upload: boolean;
  running: PresenceProgress;
  stored: PresenceProgress;
  no_archive: boolean;
}

export interface ProgressInfo {
  running: PresenceProgress;
  stored: PresenceProgress;
}

export type PresenceProgress =
  | PresenceProgressFull
  | PresenceProgressEmpty
  | PresenceProgressNone;

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

export enum InstanceType {
  Cores1 = "Cores1",
  Cores2 = "Cores2",
  Cores4 = "Cores4",
  Cores8 = "Cores8",
  Cores16 = "Cores16",
  Cores32 = "Cores32",
}

export type NCores = 1 | 2 | 4 | 8 | 16 | 32;

export function coresToInstance(nCores: NCores): InstanceType {
  switch (nCores) {
    case 1:
      return InstanceType.Cores1;
    case 2:
      return InstanceType.Cores2;
    case 4:
      return InstanceType.Cores4;
    case 8:
      return InstanceType.Cores8;
    case 16:
      return InstanceType.Cores16;
    case 32:
      return InstanceType.Cores32;
  }
}

export enum Phase {
  Staging = "staging",
  Storage = "storage",
  Running = "running",
}

export interface User {
  Sc?: {
    account_id: string;
    username: string;
  };
  Id?: {
    id: string;
  };
}

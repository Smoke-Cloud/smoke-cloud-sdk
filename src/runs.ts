import type {
  AccountId,
  PresenceProgress,
  PresenceProgressFull,
  RunEntry,
  RunId,
} from "./coreTypes.ts";
import type { RunData } from "./getS3CSVData.ts";

function maybeDate(date: string | undefined): Date | undefined {
  return date ? new Date(date) : undefined;
}
function maybeDateOut(date: Date | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}
export class Run {
  public runId: RunId;
  public accountId: AccountId;
  public chid: string;
  public openTime: Date;
  public closeTime?: Date;
  public archived?: Date;
  public updateTime?: Date;
  public username?: string;
  public project?: string;
  public version: number;
  public manualUpload: boolean;
  public running: PresenceProgress;
  public stored: PresenceProgress;
  public noArchive: boolean;
  public runParams?: {
    instance_type: string;
    fds_version: string;
    core_count: number;
    mem_gb: number;
    n_processes?: number;
    n_threads?: number;
  };
  constructor(
    status: RunEntry,
  ) {
    this.runId = status.run_id;
    this.accountId = status.sim_id.account_id;
    this.chid = status.sim_id.chid;
    this.openTime = new Date(status.open_time);
    this.closeTime = maybeDate(status.close_time);
    this.archived = maybeDate(status.archived);
    this.updateTime = maybeDate(status.update_time);
    this.username = status.username;
    this.project = status.project_number;
    this.version = status.version;
    this.manualUpload = status.manual_upload;
    this.running = status.running;
    this.stored = status.stored;
    this.noArchive = status.no_archive;
    this.runParams = status.run_params;
  }
  public runEntry(): RunEntry {
    return {
      run_id: this.runId,
      sim_id: { account_id: this.accountId, chid: this.chid },
      open_time: this.openTime.toISOString(),
      close_time: maybeDateOut(this.closeTime),
      archived: maybeDateOut(this.archived),
      update_time: maybeDateOut(this.updateTime),
      username: this.username,
      project_number: this.project,
      version: this.version,
      manual_upload: this.manualUpload,
      running: this.running,
      stored: this.stored,
      no_archive: this.noArchive,
      run_params: this.runParams,
    };
  }

  public get isArchived(): boolean {
    return this.archived ? true : false;
  }

  public get isOpen(): boolean {
    return this.closeTime ? false : true;
  }
}

export class Progress {
  public sim: {
    start_time: number;
    end_time: number;
    last_time: number;
  };
  public wall: {
    start_time: Date;
    last_time: Date;
  };
  constructor(progress: PresenceProgressFull) {
    this.sim = {
      start_time: progress.sim.start_time,
      last_time: progress.sim.last_time,
      end_time: progress.sim.end_time,
    };
    this.wall = {
      start_time: new Date(progress.wall.start_time),
      last_time: new Date(progress.wall.last_time),
    };
  }

  static fromRunData(runData: RunData): Progress | undefined {
    const firstTimeStep = runData.time_steps.values[0];
    const lastTimeStep =
      runData.time_steps.values[runData.time_steps.values.length - 1];
    if (!firstTimeStep && !lastTimeStep) {
      return;
    }
    if (runData.start_time === undefined) return;
    if (lastTimeStep.x === undefined) return;
    if (runData.end_time === undefined) return;
    if (firstTimeStep.y === undefined) return;
    if (lastTimeStep.y === undefined) return;
    return new Progress({
      present: true,
      sim: {
        start_time: runData.start_time,
        last_time: lastTimeStep.x,
        end_time: runData.end_time,
      },
      wall: {
        start_time: firstTimeStep.y,
        last_time: lastTimeStep.y,
      },
    });
  }

  public get progressFraction(): number {
    return (
      (this.sim.last_time - this.sim.start_time) /
      (this.sim.end_time - this.sim.start_time)
    );
  }

  public get progressPercent(): number {
    return this.progressFraction * 100;
  }
}

import type { ProjectEntry, ProjectStorage, Uuid } from "./coreTypes.ts";

export class Project {
  public readonly id: Uuid;
  //   public orgId: string;
  public readonly number: string;
  public readonly title?: string;
  public readonly created: Date;

  //   public  simulations: 24;
  //   public  live: 2;
  //   public  archived: 18;
  //   public  spent: 1842.5;
  //   public  model: "FDS / FARSITE";
  public readonly softLimit: number | null;
  public readonly hardLimit: number | null;
  /** Spend so far, as [currency, minor units]; null if it has no runs or
   * the API didn't say. */
  public readonly spend: [string, number] | null;
  /** Bytes stored now; null if nothing is stored or the API didn't say. */
  public readonly storage: ProjectStorage | null;

  constructor(status: ProjectEntry) {
    this.id = status.id;
    this.number = status.number;
    this.title = status.title ?? undefined;
    this.softLimit = status.soft_limit ?? null;
    this.hardLimit = status.hard_limit ?? null;
    this.created = new Date(status.creation_date);
    this.spend = status.spend ?? null;
    this.storage = status.storage ?? null;
  }
}

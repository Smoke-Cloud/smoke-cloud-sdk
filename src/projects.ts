import type { ProjectEntry, Uuid } from "./coreTypes.ts";

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

  constructor(
    status: ProjectEntry,
  ) {
    this.id = status.id;
    this.number = status.number;
    this.title = status.title ?? undefined;
    this.softLimit = status.soft_limit ?? null;
    this.hardLimit = status.hard_limit ?? null;
    this.created = new Date(status.creation_date);
  }
}

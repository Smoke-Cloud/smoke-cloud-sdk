import type { ProjectEntry, Uuid } from "./coreTypes.ts";

export class Project {
  public id: Uuid;
  //   public orgId: string;
  public number: string;
  public title?: string;
  //   public created: Date;

  //   public  simulations: 24;
  //   public  live: 2;
  //   public  archived: 18;
  //   public  spent: 1842.5;
  //   public  model: "FDS / FARSITE";
  public softLimit: [string, number] | null;
  public hardLimit: [string, number] | null;

  constructor(
    status: ProjectEntry,
  ) {
    this.id = status.id;
    this.number = status.number;
    this.title = status.title ?? undefined;
    this.softLimit = status.soft_limit ?? null;
    this.hardLimit = status.hard_limit ?? null;
  }
}

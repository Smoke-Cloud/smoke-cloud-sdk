import type { DistributionModel, FullDistribution } from "./coreTypes.ts";

export class Distribution {
  public accountId: string;
  public key: string;
  public name: string;
  public org_id: string;
  public project: string | null;
  public models: DistributionModel[];
  constructor(
    accountId: string,
    status: FullDistribution,
  ) {
    this.accountId = accountId;
    this.key = status.key;
    this.name = status.name;
    this.org_id = status.org_id;
    this.project = status.project;
    this.models = status.models;
  }
  public get id(): string {
    return this.key;
  }
  public get public(): boolean {
    return true;
  }
  public get shareToken(): string {
    return this.key;
  }
  public get shareUrl(): string {
    return `https://smokecloud.io/distribution/${this.accountId}/${this.shareToken}`;
  }
  public get created(): Date {
    return new Date();
  }
}

export class DistributedModel {
  public chid: string;
  public description: string;
  public model_index: number;
  public size: number | null;
  constructor(status: DistributionModel) {
    this.chid = status.chid;
    this.description = status.description;
    this.model_index = status.model_index;
    this.size = status.size;
  }
}

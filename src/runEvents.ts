// These are the front facing event types which may have been translated slightly from the backend.
// TODO: Are these steps? Are there sub-steps? This should all be encoded as part of the state machine, including any flexibility (or lack thereof).
export type PublicEvent =
  | "created"
  | "input_uploaded"
  | "queued"
  | "pre_processed"
  | "started"
  | "stopped"
  | "storage_started"
  | "storage_ended"
  | "close"
  | "deprecate"
  | "archive";

export interface PublicEventRecord {
  id: string;
  event: PublicEvent;
  time: string;
}

export interface RunEvents {
  run_id: string;
  events: PublicEventRecord[];
}

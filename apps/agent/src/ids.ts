import { randomUUID } from "node:crypto";

/** Short unique id for runs and decisions. */
export const newId = (): string => randomUUID();

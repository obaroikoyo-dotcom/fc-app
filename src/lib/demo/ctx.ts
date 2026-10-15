import type { Db } from "./query";
import type { DemoSession } from "./session";

// What every fake endpoint needs to know: the database, and who the visitor is.
export interface Ctx {
  db: Db;
  session: DemoSession;
}

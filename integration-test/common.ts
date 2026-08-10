import { WebsocketFactory } from "../src/lib/sql-client";

export type TestEnvironment = "Node" | "Browser";
export type TestWebsocketFactory = (cert?: string | undefined) => WebsocketFactory;

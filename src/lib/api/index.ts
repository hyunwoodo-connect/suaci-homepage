import type { ApiClient } from "./client";
import { createMockClient } from "./mock";
import { createHttpClient } from "./http";

const MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
export const api: ApiClient = MODE === "http" ? createHttpClient() : createMockClient();
export type { ApiClient } from "./client";
export { ApiClientError } from "./errors";

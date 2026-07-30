import { ProviderError } from "../errors.js";

export function parseJsonText<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ProviderError("parse_error", {
      message: "Upstream JSON response could not be parsed.",
      cause: error,
    });
  }
}

export async function parseJsonResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  return parseJsonText<T>(text);
}

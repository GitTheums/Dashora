export function parseTextResponse(body: string): string {
  return body;
}

export async function readTextResponse(response: Response): Promise<string> {
  return response.text();
}

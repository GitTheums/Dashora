import http from "node:http";
import type { AddressInfo } from "node:net";

export type MockUpstreamHandler = (
  request: http.IncomingMessage,
  response: http.ServerResponse,
) => void | Promise<void>;

export type MockUpstreamServer = {
  baseUrl: string;
  close: () => Promise<void>;
  setHandler: (handler: MockUpstreamHandler) => void;
  requestCount: () => number;
};

/**
 * Lightweight local HTTP upstream for provider platform tests.
 */
export async function startMockUpstream(
  initialHandler?: MockUpstreamHandler,
): Promise<MockUpstreamServer> {
  let handler: MockUpstreamHandler =
    initialHandler ??
    ((_req, res) => {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain");
      res.end("ok");
    });
  let requests = 0;

  const server = http.createServer((req, res) => {
    requests += 1;
    void Promise.resolve(handler(req, res)).catch(() => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("mock upstream error");
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requestCount: () => requests,
    setHandler: (next) => {
      handler = next;
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

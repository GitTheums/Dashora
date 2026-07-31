import type { FastifyInstance } from "fastify";

export type GracefulShutdownOptions = {
  /** Signals to handle. Defaults to SIGINT and SIGTERM. */
  signals?: readonly NodeJS.Signals[];
  /** Process to attach listeners to. Defaults to the global process. */
  processRef?: NodeJS.Process;
  /** Exit helper (injectable for tests). */
  exit?: (code: number) => void;
};

/**
 * Closes the Fastify app (and its onClose hooks) when a termination signal arrives.
 * Concurrent signals are ignored after the first close is scheduled.
 */
export function registerGracefulShutdown(
  app: FastifyInstance,
  options: GracefulShutdownOptions = {},
): () => void {
  const signals = options.signals ?? (["SIGINT", "SIGTERM"] as const);
  const processRef = options.processRef ?? process;
  const exit = options.exit ?? ((code: number) => processRef.exit(code));
  let shuttingDown = false;

  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, "Shutting down gracefully");
    void app
      .close()
      .then(() => {
        exit(0);
      })
      .catch((error: unknown) => {
        app.log.error(error, "Error during graceful shutdown");
        exit(1);
      });
  };

  for (const signal of signals) {
    processRef.on(signal, onSignal);
  }

  return () => {
    for (const signal of signals) {
      processRef.off(signal, onSignal);
    }
  };
}

import type { FastifyReply } from "fastify";

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
) {
  return reply.status(statusCode).send({
    error: {
      code,
      message,
    },
  });
}

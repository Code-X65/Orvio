import type { FastifyReply } from 'fastify';

export interface SuccessResponseEnvelope<T> {
  status: 'success';
  data: T;
  requestId?: string;
}

export function sendData<T>(
  reply: FastifyReply,
  data: T,
  statusCode: number = 200
) {
  const envelope: SuccessResponseEnvelope<T> = {
    status: 'success',
    data,
    ...(reply.request?.id ? { requestId: reply.request.id } : {}),
  };
  return reply.status(statusCode).send(envelope);
}

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { ApiError, apiRequest } from './api';
import { server } from '../test/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('apiRequest', () => {
  it('returns data from the standard API envelope', async () => {
    server.use(http.get('http://localhost:3000/api/v1/products', () => HttpResponse.json({ data: [{ id: 'p1' }], meta: { requestId: 'req-1' } })));
    await expect(apiRequest<Array<{ id: string }>>('/products')).resolves.toEqual({ data: [{ id: 'p1' }], meta: { requestId: 'req-1' } });
  });

  it('normalizes documented API failures', async () => {
    server.use(http.get('http://localhost:3000/api/v1/products', () => HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Access denied.', requestId: 'req-2' } }, { status: 403 })));
    await expect(apiRequest('/products')).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403, requestId: 'req-2' } satisfies Partial<ApiError>);
  });
});

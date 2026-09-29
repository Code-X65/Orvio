import { describe, expect, it } from 'vitest';

import { redactedLogPaths } from '../../src/config/logger.js';

describe('logging redaction', () => {
  it('redacts authentication and credential fields', () => {
    expect(redactedLogPaths).toEqual(expect.arrayContaining(['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'refreshToken']));
  });
});

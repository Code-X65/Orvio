import { describe, expect, it } from 'vitest';

import { assertSeedEnvironment, seedCredentials } from '../../prisma/seed.js';

describe('seed safeguards', () => {
  it('rejects production execution before accessing the database', () => {
    expect(() => assertSeedEnvironment('production')).toThrow('Refusing to seed a production database.');
  });

  it('uses deterministic non-production identities', () => {
    expect(seedCredentials.email).toBe('owner@orvio.test');
  });
});

import { describe, it, expect } from 'vitest';
import { extractRequestedBranchId } from '../../src/middleware/branch-guard.js';

describe('Branch Guard Middleware', () => {
  it('extracts branchId from request params', () => {
    const req = {
      params: { branchId: 'branch_123' },
      query: {},
      headers: {},
    } as any;
    expect(extractRequestedBranchId(req)).toBe('branch_123');
  });

  it('extracts branch_id from request query', () => {
    const req = {
      params: {},
      query: { branch_id: 'branch_query_abc' },
      headers: {},
    } as any;
    expect(extractRequestedBranchId(req)).toBe('branch_query_abc');
  });

  it('extracts branch from URL query ?branch=...', () => {
    const req = {
      params: {},
      query: { branch: 'branch_url_param' },
      headers: {},
    } as any;
    expect(extractRequestedBranchId(req)).toBe('branch_url_param');
  });

  it('extracts branchId from body', () => {
    const req = {
      params: {},
      query: {},
      body: { branchId: 'branch_in_body' },
      headers: {},
    } as any;
    expect(extractRequestedBranchId(req)).toBe('branch_in_body');
  });

  it('extracts branch from x-active-branch header', () => {
    const req = {
      params: {},
      query: {},
      headers: { 'x-active-branch': 'branch_header_xyz' },
    } as any;
    expect(extractRequestedBranchId(req)).toBe('branch_header_xyz');
  });

  it('returns null when no branch is specified in request', () => {
    const req = {
      params: {},
      query: {},
      headers: {},
    } as any;
    expect(extractRequestedBranchId(req)).toBeNull();
  });
});

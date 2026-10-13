import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft, cleanupStaleDrafts } from './useFormDraft';

describe('useFormDraft Hook & Draft Envelope Storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with null draft when sessionStorage is empty', () => {
    const { result } = renderHook(() => useFormDraft('test_form', { name: '' }));
    expect(result.current.draft).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it('saves draft in envelope format with timestamp and allows reading', () => {
    const { result } = renderHook(() =>
      useFormDraft<{ name: string; sku: string }>('new_product', { name: '', sku: '' })
    );

    act(() => {
      result.current.saveDraft({ name: 'Sneakers', sku: 'SNK-001' });
    });

    expect(result.current.draft).toEqual({ name: 'Sneakers', sku: 'SNK-001' });
    expect(result.current.hasDraft).toBe(true);

    const storedRaw = sessionStorage.getItem('orvio_draft_new_product');
    expect(storedRaw).toBeDefined();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed.data).toEqual({ name: 'Sneakers', sku: 'SNK-001' });
    expect(typeof parsed.updatedAt).toBe('number');
    expect(parsed.version).toBe(1);
  });

  it('supports namespaced draft keys to prevent collisions between workspaces', () => {
    const { result } = renderHook(() =>
      useFormDraft<{ title: string }>('product_1', { title: '' }, { namespace: 'org_acme' })
    );

    act(() => {
      result.current.saveDraft({ title: 'Acme Widget' });
    });

    expect(sessionStorage.getItem('orvio_draft_org_acme_product_1')).toBeDefined();
    expect(sessionStorage.getItem('orvio_draft_product_1')).toBeNull();
  });

  it('expires drafts older than the configured TTL and purges them on read', () => {
    const now = Date.now();
    const staleTime = now - 5000; // 5 seconds ago

    const envelope = {
      data: { name: 'Old Draft' },
      updatedAt: staleTime,
      version: 1,
    };
    sessionStorage.setItem('orvio_draft_stale_item', JSON.stringify(envelope));

    // Initialize with 2-second TTL
    const { result } = renderHook(() =>
      useFormDraft('stale_item', { name: '' }, { ttlMs: 2000 })
    );

    expect(result.current.draft).toBeNull();
    expect(result.current.hasDraft).toBe(false);
    expect(sessionStorage.getItem('orvio_draft_stale_item')).toBeNull();
  });

  it('cleanupStaleDrafts purges expired drafts and leaves fresh drafts intact', () => {
    const now = Date.now();
    // 1 expired draft
    sessionStorage.setItem(
      'orvio_draft_expired_1',
      JSON.stringify({ data: { a: 1 }, updatedAt: now - 100_000, version: 1 })
    );
    // 1 fresh draft
    sessionStorage.setItem(
      'orvio_draft_fresh_1',
      JSON.stringify({ data: { b: 2 }, updatedAt: now, version: 1 })
    );

    const cleaned = cleanupStaleDrafts(50_000); // 50s max age
    expect(cleaned).toBe(1);
    expect(sessionStorage.getItem('orvio_draft_expired_1')).toBeNull();
    expect(sessionStorage.getItem('orvio_draft_fresh_1')).toBeDefined();
  });

  it('clearDraft removes the specific draft from sessionStorage', () => {
    const { result } = renderHook(() =>
      useFormDraft<{ name: string }>('item_to_clear', { name: '' })
    );

    act(() => {
      result.current.saveDraft({ name: 'Temporary' });
    });
    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.clearDraft();
    });
    expect(result.current.draft).toBeNull();
    expect(result.current.hasDraft).toBe(false);
    expect(sessionStorage.getItem('orvio_draft_item_to_clear')).toBeNull();
  });
});

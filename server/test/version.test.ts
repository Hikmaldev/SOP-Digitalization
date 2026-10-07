import { describe, expect, it } from 'vitest';
import { InvalidTransitionError } from '../src/lib/errors';
import { ALLOWED_TRANSITIONS, assertTransitionAllowed } from '../src/services/version.service';
import type { VersionStatus } from '../src/types';

/**
 * State machine tests (PRD §13: "attempt every invalid transition ...
 * and confirm each one is rejected"). Mirrors design doc §5.
 */
describe('version state machine', () => {
  it('allows the happy path: draft -> pending_approval', () => {
    expect(() => assertTransitionAllowed('draft', 'pending_approval')).not.toThrow();
  });

  it('allows pending_approval -> published and -> rejected', () => {
    expect(() => assertTransitionAllowed('pending_approval', 'published')).not.toThrow();
    expect(() => assertTransitionAllowed('pending_approval', 'rejected')).not.toThrow();
  });

  it('allows published -> superseded (only via a newer approval)', () => {
    expect(() => assertTransitionAllowed('published', 'superseded')).not.toThrow();
  });

  it('rejects draft -> published (skipping approval)', () => {
    expect(() => assertTransitionAllowed('draft', 'published')).toThrow(InvalidTransitionError);
  });

  it('rejects draft -> rejected and draft -> superseded', () => {
    expect(() => assertTransitionAllowed('draft', 'rejected')).toThrow(InvalidTransitionError);
    expect(() => assertTransitionAllowed('draft', 'superseded')).toThrow(InvalidTransitionError);
  });

  it('has no un-publish edge: published -> draft / rejected throws', () => {
    expect(() => assertTransitionAllowed('published', 'draft')).toThrow(InvalidTransitionError);
    expect(() => assertTransitionAllowed('published', 'rejected')).toThrow(InvalidTransitionError);
  });

  it('treats superseded and rejected as terminal states', () => {
    expect(ALLOWED_TRANSITIONS.superseded).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.rejected).toHaveLength(0);
  });

  it('never allows a status to transition to itself', () => {
    for (const status of Object.keys(ALLOWED_TRANSITIONS) as VersionStatus[]) {
      expect(ALLOWED_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it('exposes the exact five states with one-directional edges', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([
      'draft',
      'pending_approval',
      'published',
      'rejected',
      'superseded',
    ]);
  });
});

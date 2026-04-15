/**
 * ORX 2.0 Fact Lifecycle — Client-side helpers
 *
 * Defines valid transitions, display labels, and API wrappers
 * for the ORX dimension facts lifecycle.
 */

import type { OrxDimensionFactStatus } from '@/types/orxDimensionFacts';

// ── Valid transitions map ──

export const VALID_TRANSITIONS: Record<OrxDimensionFactStatus, OrxDimensionFactStatus[]> = {
  candidate: ['internal_approved', 'rejected'],
  internal_approved: ['published', 'rejected', 'stale', 'superseded'],
  rejected: ['candidate'],
  stale: ['candidate', 'superseded'],
  superseded: [],
  published: ['stale', 'superseded'],
};

// ── Status display metadata ──

export interface StatusMeta {
  label: string;
  color: string;
  description: string;
}

export const STATUS_META: Record<OrxDimensionFactStatus, StatusMeta> = {
  candidate: {
    label: 'Candidate',
    color: 'amber',
    description: 'Awaiting internal review',
  },
  internal_approved: {
    label: 'Approved',
    color: 'blue',
    description: 'Internally approved, not yet public',
  },
  published: {
    label: 'Published',
    color: 'green',
    description: 'Live and publicly visible',
  },
  rejected: {
    label: 'Rejected',
    color: 'red',
    description: 'Reviewed and rejected',
  },
  stale: {
    label: 'Stale',
    color: 'orange',
    description: 'Data freshness exceeded',
  },
  superseded: {
    label: 'Superseded',
    color: 'gray',
    description: 'Replaced by newer fact',
  },
};

/**
 * Check if a transition is valid.
 */
export function isValidTransition(
  from: OrxDimensionFactStatus,
  to: OrxDimensionFactStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get allowed next statuses for a fact.
 */
export function getAllowedTransitions(
  currentStatus: OrxDimensionFactStatus
): OrxDimensionFactStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Get action label for a transition (for UI buttons).
 */
export function getTransitionActionLabel(to: OrxDimensionFactStatus): string {
  switch (to) {
    case 'internal_approved': return 'Approve';
    case 'published': return 'Publish';
    case 'rejected': return 'Reject';
    case 'stale': return 'Mark Stale';
    case 'superseded': return 'Supersede';
    case 'candidate': return 'Reopen';
    default: return to;
  }
}

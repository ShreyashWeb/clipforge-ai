import { describe, expect, it } from 'vitest';
import {
  JOB_STATUSES,
  canTransition,
  transition,
} from '../src/pipeline/stateMachine.js';

describe('job state machine', () => {
  it('allows the approved production path', () => {
    const path = [
      JOB_STATUSES.INTERVIEW,
      JOB_STATUSES.ANGLE_APPROVAL,
      JOB_STATUSES.SCRIPT,
      JOB_STATUSES.STORYBOARD_APPROVAL,
      JOB_STATUSES.RENDER,
      JOB_STATUSES.FINAL_APPROVAL,
      JOB_STATUSES.PUBLISHED,
    ];

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(transition(path[index], path[index + 1])).toBe(path[index + 1]);
    }
  });

  it.each([
    [JOB_STATUSES.INTERVIEW, JOB_STATUSES.SCRIPT],
    [JOB_STATUSES.SCRIPT, JOB_STATUSES.RENDER],
    [JOB_STATUSES.PUBLISHED, JOB_STATUSES.INTERVIEW],
    [JOB_STATUSES.FAILED, JOB_STATUSES.INTERVIEW],
  ])('rejects invalid transition %s -> %s', (currentStatus, nextStatus) => {
    expect(canTransition(currentStatus, nextStatus)).toBe(false);
    expect(() => transition(currentStatus, nextStatus)).toThrow(/Invalid job transition/);
  });

  it('allows approval rejection and failure paths', () => {
    expect(transition(JOB_STATUSES.ANGLE_APPROVAL, JOB_STATUSES.REJECTED)).toBe(
      JOB_STATUSES.REJECTED,
    );
    expect(transition(JOB_STATUSES.RENDER, JOB_STATUSES.FAILED)).toBe(JOB_STATUSES.FAILED);
  });
});

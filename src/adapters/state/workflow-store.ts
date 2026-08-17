import type { WorkflowState } from '../../workflows/state.js';

export interface WorkflowStore {
  get(id: string): Promise<WorkflowState | null>;
  save(state: WorkflowState, expectedVersion?: number): Promise<void>;
}

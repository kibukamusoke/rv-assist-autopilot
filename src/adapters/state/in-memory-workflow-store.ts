import type { WorkflowState } from '../../workflows/state.js';
import type { WorkflowStore } from './workflow-store.js';

export class InMemoryWorkflowStore implements WorkflowStore {
  readonly #states = new Map<string, WorkflowState>();

  async get(id: string): Promise<WorkflowState | null> {
    const state = this.#states.get(id);
    return state ? structuredClone(state) : null;
  }

  async save(state: WorkflowState, expectedVersion?: number): Promise<void> {
    const current = this.#states.get(state.id);
    if (expectedVersion !== undefined && current?.version !== expectedVersion) {
      throw new Error(`Workflow ${state.id} was modified concurrently`);
    }
    this.#states.set(state.id, structuredClone(state));
  }
}

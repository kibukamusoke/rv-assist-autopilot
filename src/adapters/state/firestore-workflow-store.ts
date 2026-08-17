import { Firestore } from '@google-cloud/firestore';
import { workflowStateSchema, type WorkflowState } from '../../workflows/state.js';
import type { WorkflowStore } from './workflow-store.js';

export class FirestoreWorkflowStore implements WorkflowStore {
  readonly #firestore: Firestore;

  constructor(
    firestore = new Firestore(),
    private readonly collection = 'autopilotWorkflows',
  ) {
    this.#firestore = firestore;
  }

  async get(id: string): Promise<WorkflowState | null> {
    const snapshot = await this.#firestore.collection(this.collection).doc(id).get();
    return snapshot.exists ? workflowStateSchema.parse(snapshot.data()) : null;
  }

  async save(state: WorkflowState, expectedVersion?: number): Promise<void> {
    const reference = this.#firestore.collection(this.collection).doc(state.id);
    await this.#firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const currentVersion = snapshot.exists
        ? workflowStateSchema.parse(snapshot.data()).version
        : undefined;
      if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
        throw new Error(`Workflow ${state.id} was modified concurrently`);
      }
      transaction.set(reference, state);
    });
  }
}

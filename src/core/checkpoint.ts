import * as fs from 'fs';
import * as path from 'path';
import { CheckpointData, ExecutionResult } from '../types';

/**
 * CheckpointManager — Persist and restore workflow state for fault tolerance.
 * Enables resume-from-checkpoint when workflows fail partway through.
 */
export class CheckpointManager {
  private readonly stateDir: string;

  constructor(stateDir: string) {
    this.stateDir = stateDir;
  }

  /** Save a checkpoint to disk */
  async save(checkpoint: CheckpointData): Promise<void> {
    await fs.promises.mkdir(this.stateDir, { recursive: true });

    const serializable = {
      ...checkpoint,
      completedNodes: Object.fromEntries(checkpoint.completedNodes),
    };

    const filePath = path.join(this.stateDir, `${checkpoint.workflowId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf-8');
  }

  /** Load the latest checkpoint for a workflow */
  async load(workflowId: string): Promise<CheckpointData | null> {
    const filePath = path.join(this.stateDir, `${workflowId}.json`);

    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      return {
        ...parsed,
        completedNodes: new Map(Object.entries(parsed.completedNodes)) as Map<string, ExecutionResult>,
      };
    } catch {
      return null;
    }
  }

  /** Delete a checkpoint */
  async delete(workflowId: string): Promise<void> {
    const filePath = path.join(this.stateDir, `${workflowId}.json`);
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /** List all available checkpoints */
  async list(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.stateDir);
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }
}

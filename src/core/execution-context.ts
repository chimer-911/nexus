import { ExecutionResult } from '../types';

/**
 * ExecutionContext — Shared state container for a workflow execution.
 * Provides a structured way for agents to share data across the DAG.
 */
export class ExecutionContext {
  private readonly data: Map<string, unknown> = new Map();
  private readonly results: Map<string, ExecutionResult> = new Map();
  private readonly metadata: Record<string, unknown> = {};

  constructor(initialData?: Record<string, unknown>) {
    if (initialData) {
      for (const [key, value] of Object.entries(initialData)) {
        this.data.set(key, value);
      }
    }
  }

  /** Set a value in the context */
  set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  /** Get a value from the context */
  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  /** Check if a key exists */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /** Store an execution result */
  setResult(nodeId: string, result: ExecutionResult): void {
    this.results.set(nodeId, result);
  }

  /** Get a specific result */
  getResult(nodeId: string): ExecutionResult | undefined {
    return this.results.get(nodeId);
  }

  /** Get all results */
  getAllResults(): Map<string, ExecutionResult> {
    return new Map(this.results);
  }

  /** Get the output of a specific node */
  getOutput(nodeId: string): string | undefined {
    return this.results.get(nodeId)?.output;
  }

  /** Get total cost across all results */
  getTotalCost(): number {
    return Array.from(this.results.values()).reduce((sum, r) => sum + r.costUsd, 0);
  }

  /** Get total tokens across all results */
  getTotalTokens(): number {
    return Array.from(this.results.values()).reduce((sum, r) => sum + r.tokens.total, 0);
  }

  /** Export context as a plain object */
  toJSON(): Record<string, unknown> {
    return {
      data: Object.fromEntries(this.data),
      results: Object.fromEntries(
        Array.from(this.results.entries()).map(([k, v]) => [k, v])
      ),
      metadata: this.metadata,
    };
  }
}

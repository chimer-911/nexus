import { EventEmitter } from 'events';
import { WorkflowConfig, ExecutionResult, AgentConfig } from '../types';
import { Agent } from './agent';
import { DAGEngine } from './dag';
import { CheckpointManager } from './checkpoint';

/**
 * Workflow — Executes a DAG of agent tasks with concurrency control,
 * checkpointing, and live progress reporting.
 */
export class Workflow extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  private readonly config: WorkflowConfig;
  private readonly agents: Map<string, Agent>;
  private readonly dag: DAGEngine;
  private readonly checkpoints: CheckpointManager;
  private results: Map<string, ExecutionResult> = new Map();
  private isRunning = false;
  private isCancelled = false;
  private startTime = 0;

  constructor(config: WorkflowConfig, agents: Map<string, Agent>, stateDir?: string) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.agents = agents;
    this.dag = new DAGEngine(config.nodes, config.edges);
    this.checkpoints = new CheckpointManager(stateDir ?? '.nexus/checkpoints');
  }

  /**
   * Execute the entire workflow
   */
  async execute(context: Record<string, unknown> = {}): Promise<Map<string, ExecutionResult>> {
    this.isRunning = true;
    this.isCancelled = false;
    this.startTime = Date.now();

    this.emit('workflow:start', { workflowId: this.id, name: this.name });

    // Check for existing checkpoint to resume from
    const checkpoint = await this.checkpoints.load(this.id);
    if (checkpoint) {
      this.results = new Map(checkpoint.completedNodes);
      this.emit('workflow:resumed', { checkpointId: checkpoint.id, completedNodes: this.results.size });
    }

    const maxConcurrency = this.config.maxConcurrency ?? 5;
    const timeoutMs = this.config.timeoutMs ?? 600000; // 10 min default

    try {
      while (true) {
        // Check cancellation
        if (this.isCancelled) {
          this.emit('workflow:cancelled', { workflowId: this.id });
          break;
        }

        // Check timeout
        if (Date.now() - this.startTime > timeoutMs) {
          this.emit('workflow:timeout', { workflowId: this.id, elapsed: Date.now() - this.startTime });
          break;
        }

        // Get nodes that are ready to execute
        const readyNodes = this.dag.getReadyNodes(this.results, context);
        if (readyNodes.length === 0) break; // All done or stuck

        // Execute ready nodes with concurrency limit
        const batch = readyNodes.slice(0, maxConcurrency);

        this.emit('workflow:batch', {
          workflowId: this.id,
          nodes: batch.map((n) => n.id),
          total: readyNodes.length,
        });

        const batchResults = await Promise.allSettled(
          batch.map(async (node) => {
            const agent = this.agents.get(node.agentId);
            if (!agent) {
              throw new Error(`Agent "${node.agentId}" not found for node "${node.id}"`);
            }

            // Interpolate prompt with results from completed dependencies
            const prompt = this.dag.interpolatePrompt(node.prompt, this.results, context);

            this.emit('node:start', { workflowId: this.id, nodeId: node.id, agentId: node.agentId });

            const result = await agent.execute(prompt, { nodeId: node.id });

            this.emit('node:complete', {
              workflowId: this.id,
              nodeId: node.id,
              success: result.success,
              durationMs: result.durationMs,
              costUsd: result.costUsd,
            });

            return { nodeId: node.id, result };
          })
        );

        // Process batch results
        for (const settled of batchResults) {
          if (settled.status === 'fulfilled') {
            this.results.set(settled.value.nodeId, settled.value.result);
          } else {
            // Create failure result for rejected promises
            const error = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
            this.emit('node:error', { workflowId: this.id, error });
          }
        }

        // Save checkpoint after each batch
        if (this.config.enableCheckpoints) {
          await this.saveCheckpoint();
        }

        // Check global budget
        if (this.config.budget) {
          const totalCost = Array.from(this.results.values()).reduce((sum, r) => sum + r.costUsd, 0);
          if (totalCost >= this.config.budget.maxCostUsd) {
            this.emit('workflow:budget-exceeded', { workflowId: this.id, totalCost });
            if (this.config.budget.onExceeded === 'kill') break;
          }
        }
      }
    } finally {
      this.isRunning = false;
    }

    const totalCost = Array.from(this.results.values()).reduce((sum, r) => sum + r.costUsd, 0);
    const totalTokens = Array.from(this.results.values()).reduce((sum, r) => sum + r.tokens.total, 0);

    this.emit('workflow:complete', {
      workflowId: this.id,
      totalNodes: this.results.size,
      totalCost,
      totalTokens,
      durationMs: Date.now() - this.startTime,
      success: Array.from(this.results.values()).every((r) => r.success),
    });

    return this.results;
  }

  /** Cancel a running workflow */
  cancel(): void {
    this.isCancelled = true;
  }

  /** Get current execution status */
  getStatus() {
    const totalCost = Array.from(this.results.values()).reduce((sum, r) => sum + r.costUsd, 0);
    return {
      workflowId: this.id,
      isRunning: this.isRunning,
      completedNodes: this.results.size,
      totalNodes: this.config.nodes.length,
      totalCost,
      elapsed: this.isRunning ? Date.now() - this.startTime : 0,
      results: Object.fromEntries(this.results),
    };
  }

  /** Get the DAG visualization */
  getMermaidDiagram(): string {
    return this.dag.toMermaid();
  }

  private async saveCheckpoint(): Promise<void> {
    const totalCost = Array.from(this.results.values()).reduce((sum, r) => sum + r.costUsd, 0);
    const totalTokens = Array.from(this.results.values()).reduce((sum, r) => sum + r.tokens.total, 0);

    await this.checkpoints.save({
      id: `${this.id}-${Date.now()}`,
      workflowId: this.id,
      completedNodes: this.results,
      pendingNodes: this.config.nodes.filter((n) => !this.results.has(n.id)).map((n) => n.id),
      state: {},
      totalCostUsd: totalCost,
      totalTokens,
      timestamp: Date.now(),
    });
  }
}

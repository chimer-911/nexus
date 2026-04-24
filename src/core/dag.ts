import { DAGNode, DAGEdge, ExecutionResult } from '../types';

/**
 * DAGEngine — Directed Acyclic Graph execution engine for workflow orchestration.
 * Handles topological sorting, parallel execution, conditional branching, and data flow.
 */
export class DAGEngine {
  private nodes: Map<string, DAGNode> = new Map();
  private edges: DAGEdge[] = [];
  private adjacency: Map<string, string[]> = new Map();
  private reverseAdjacency: Map<string, string[]> = new Map();

  constructor(nodes: DAGNode[], edges: DAGEdge[]) {
    for (const node of nodes) {
      this.nodes.set(node.id, node);
      this.adjacency.set(node.id, []);
      this.reverseAdjacency.set(node.id, []);
    }

    this.edges = edges;
    for (const edge of edges) {
      this.adjacency.get(edge.from)?.push(edge.to);
      this.reverseAdjacency.get(edge.to)?.push(edge.from);
    }

    this.validateDAG();
  }

  /** Get nodes that have no dependencies (entry points) */
  getRootNodes(): DAGNode[] {
    const roots: DAGNode[] = [];
    for (const [nodeId, deps] of this.reverseAdjacency) {
      if (deps.length === 0) {
        const node = this.nodes.get(nodeId);
        if (node) roots.push(node);
      }
    }
    return roots;
  }

  /** Get the topological execution order */
  getExecutionOrder(): DAGNode[][] {
    const levels: DAGNode[][] = [];
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Calculate in-degrees
    for (const [nodeId] of this.nodes) {
      const deps = this.reverseAdjacency.get(nodeId) ?? [];
      inDegree.set(nodeId, deps.length);
      if (deps.length === 0) queue.push(nodeId);
    }

    while (queue.length > 0) {
      const currentLevel: DAGNode[] = [];
      const nextQueue: string[] = [];

      for (const nodeId of queue) {
        const node = this.nodes.get(nodeId);
        if (node) currentLevel.push(node);

        const children = this.adjacency.get(nodeId) ?? [];
        for (const child of children) {
          const deg = (inDegree.get(child) ?? 1) - 1;
          inDegree.set(child, deg);
          if (deg === 0) nextQueue.push(child);
        }
      }

      if (currentLevel.length > 0) levels.push(currentLevel);
      queue.length = 0;
      queue.push(...nextQueue);
    }

    return levels;
  }

  /** Get ready nodes based on completed results and edge conditions */
  getReadyNodes(
    completedResults: Map<string, ExecutionResult>,
    context: Record<string, unknown> = {}
  ): DAGNode[] {
    const ready: DAGNode[] = [];

    for (const [nodeId, node] of this.nodes) {
      // Skip already completed nodes
      if (completedResults.has(nodeId)) continue;

      // Check all dependencies are completed
      const deps = this.reverseAdjacency.get(nodeId) ?? [];
      const allDepsComplete = deps.every((dep) => completedResults.has(dep));
      if (!allDepsComplete) continue;

      // Check edge conditions
      const incomingEdges = this.edges.filter((e) => e.to === nodeId);
      const conditionsMet = incomingEdges.every((edge) => {
        if (!edge.condition) return true;
        try {
          const sourceResult = completedResults.get(edge.from);
          return this.evaluateCondition(edge.condition, { ...context, result: sourceResult });
        } catch {
          return false;
        }
      });

      // Check node-level condition
      let nodeConditionMet = true;
      if (node.condition) {
        try {
          nodeConditionMet = this.evaluateCondition(node.condition, context);
        } catch {
          nodeConditionMet = false;
        }
      }

      if (conditionsMet && nodeConditionMet) {
        ready.push(node);
      }
    }

    return ready;
  }

  /** Get the dependencies of a node */
  getDependencies(nodeId: string): string[] {
    return this.reverseAdjacency.get(nodeId) ?? [];
  }

  /** Get the dependents (children) of a node */
  getDependents(nodeId: string): string[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  /** Interpolate variables into a prompt template */
  interpolatePrompt(
    template: string,
    completedResults: Map<string, ExecutionResult>,
    context: Record<string, unknown> = {}
  ): string {
    let prompt = template;

    // Replace {{nodeId.output}} patterns
    prompt = prompt.replace(/\{\{(\w+)\.output\}\}/g, (_, nodeId) => {
      const result = completedResults.get(nodeId);
      return result?.output ?? `[No output from ${nodeId}]`;
    });

    // Replace {{context.key}} patterns
    prompt = prompt.replace(/\{\{context\.(\w+)\}\}/g, (_, key) => {
      return String(context[key] ?? `[No context for ${key}]`);
    });

    // Replace {{variable}} patterns
    prompt = prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(context[key] ?? `[Unknown variable ${key}]`);
    });

    return prompt;
  }

  /** Get a visual representation of the DAG */
  toMermaid(): string {
    const lines: string[] = ['graph TD'];
    for (const [nodeId, node] of this.nodes) {
      lines.push(`  ${nodeId}["${node.agentId}"]`);
    }
    for (const edge of this.edges) {
      const label = edge.condition ? `-- "${edge.condition}" -->` : '-->';
      lines.push(`  ${edge.from} ${label} ${edge.to}`);
    }
    return lines.join('\n');
  }

  /** Validate that the graph is a proper DAG (no cycles) */
  private validateDAG(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = this.adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const [nodeId] of this.nodes) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          throw new Error(`Cycle detected in workflow DAG involving node "${nodeId}"`);
        }
      }
    }
  }

  /** Safely evaluate a condition expression */
  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    // Simple safe expression evaluator (no eval!)
    const expr = condition.trim();

    // Handle simple boolean checks
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    // Handle result.success checks
    if (expr === 'result.success') {
      const result = context.result as ExecutionResult | undefined;
      return result?.success ?? false;
    }
    if (expr === '!result.success') {
      const result = context.result as ExecutionResult | undefined;
      return !(result?.success ?? false);
    }

    // Handle comparisons like result.costUsd < 1.0
    const compareMatch = expr.match(/^(\w+(?:\.\w+)*)\\s*(===|!==|==|!=|<=|>=|<|>)\\s*(.+)$/);
    if (compareMatch) {
      const [, path, operator, rawValue] = compareMatch;
      const leftValue = this.resolvePath(context, path!);
      const rightValue = this.parseValue(rawValue!);

      switch (operator) {
        case '===':
        case '==':
          return leftValue === rightValue;
        case '!==':
        case '!=':
          return leftValue !== rightValue;
        case '<':
          return Number(leftValue) < Number(rightValue);
        case '>':
          return Number(leftValue) > Number(rightValue);
        case '<=':
          return Number(leftValue) <= Number(rightValue);
        case '>=':
          return Number(leftValue) >= Number(rightValue);
      }
    }

    // Default: treat as truthy check on a path
    const value = this.resolvePath(context, expr);
    return Boolean(value);
  }

  private resolvePath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private parseValue(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}

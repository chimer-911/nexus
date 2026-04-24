/**
 * NEXUS — Multi-Agent Orchestration Engine
 * 
 * Production-grade orchestration for heterogeneous AI agent swarms.
 * Supports A2A protocol, DAG-based workflows, circuit breakers,
 * budget guards, and live execution dashboards.
 * 
 * @module @chimer/nexus
 */

export { Nexus } from './core/nexus';
export { Agent } from './core/agent';
export { Workflow } from './core/workflow';
export { DAGEngine } from './core/dag';
export { CircuitBreaker } from './core/circuit-breaker';
export { BudgetGuard } from './core/budget-guard';
export { AgentCard } from './core/agent-card';
export { ExecutionContext } from './core/execution-context';
export { CheckpointManager } from './core/checkpoint';

// Providers
export { OpenAIProvider } from './providers/openai';
export { AnthropicProvider } from './providers/anthropic';
export { OllamaProvider } from './providers/ollama';
export { GenericProvider } from './providers/generic';

// Types
export type {
  AgentConfig,
  WorkflowConfig,
  DAGNode,
  DAGEdge,
  ExecutionResult,
  AgentMessage,
  ProviderConfig,
  BudgetConfig,
  CircuitBreakerConfig,
  CheckpointData,
  NexusConfig,
  TaskResult,
  AgentCardData,
} from './types';

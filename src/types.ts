/**
 * Core type definitions for NEXUS orchestration engine
 */

/** Configuration for an individual agent */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;
  /** Human-readable agent name */
  name: string;
  /** Agent role description for A2A discovery */
  role: string;
  /** System prompt defining agent behavior */
  systemPrompt: string;
  /** Provider to use (openai, anthropic, ollama, generic) */
  provider: string;
  /** Model identifier (e.g., gpt-5.5, claude-opus-4, llama-4) */
  model: string;
  /** Provider-specific configuration */
  providerConfig?: ProviderConfig;
  /** Budget constraints for this agent */
  budget?: BudgetConfig;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Maximum retries on failure */
  maxRetries?: number;
  /** Fallback model if primary fails */
  fallbackModel?: string;
  /** Fallback provider if primary fails */
  fallbackProvider?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens per response */
  maxTokens?: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/** Configuration for a workflow */
export interface WorkflowConfig {
  /** Unique workflow identifier */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** DAG nodes (agent tasks) */
  nodes: DAGNode[];
  /** DAG edges (dependencies) */
  edges: DAGEdge[];
  /** Global budget for the entire workflow */
  budget?: BudgetConfig;
  /** Enable checkpointing */
  enableCheckpoints?: boolean;
  /** Maximum concurrent agent executions */
  maxConcurrency?: number;
  /** Timeout for entire workflow in milliseconds */
  timeoutMs?: number;
}

/** A node in the workflow DAG */
export interface DAGNode {
  /** Unique node ID */
  id: string;
  /** Agent ID to execute at this node */
  agentId: string;
  /** Task prompt template (supports {{variable}} interpolation) */
  prompt: string;
  /** Condition to evaluate before executing (JS expression) */
  condition?: string;
  /** Transform function for input data */
  inputTransform?: string;
  /** Transform function for output data */
  outputTransform?: string;
  /** Node-specific timeout in ms */
  timeoutMs?: number;
  /** Retry count override */
  retries?: number;
}

/** An edge in the workflow DAG */
export interface DAGEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Condition for this edge (JS expression evaluating to boolean) */
  condition?: string;
  /** Data mapping from source output to target input */
  dataMap?: Record<string, string>;
}

/** Result of an agent execution */
export interface ExecutionResult {
  /** Node ID that produced this result */
  nodeId: string;
  /** Agent ID that executed */
  agentId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Output data */
  output: string;
  /** Parsed/structured output if applicable */
  structured?: unknown;
  /** Error message if failed */
  error?: string;
  /** Token usage */
  tokens: TokenUsage;
  /** Cost in USD */
  costUsd: number;
  /** Execution duration in ms */
  durationMs: number;
  /** Timestamp */
  timestamp: number;
  /** Model used (may differ from config if fallback was used) */
  modelUsed: string;
  /** Provider used */
  providerUsed: string;
  /** Whether a fallback was triggered */
  usedFallback: boolean;
}

/** Token usage breakdown */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/** Message exchanged between agents */
export interface AgentMessage {
  /** Sender agent ID */
  from: string;
  /** Receiver agent ID */
  to: string;
  /** Message content */
  content: string;
  /** Message type */
  type: 'task' | 'result' | 'error' | 'handoff' | 'status';
  /** Correlation ID for tracking message chains */
  correlationId: string;
  /** Timestamp */
  timestamp: number;
  /** Associated data payload */
  data?: unknown;
}

/** Provider configuration */
export interface ProviderConfig {
  /** API key */
  apiKey?: string;
  /** Base URL override */
  baseUrl?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in ms */
  timeoutMs?: number;
  /** Organization ID (OpenAI) */
  orgId?: string;
}

/** Budget constraints */
export interface BudgetConfig {
  /** Maximum cost in USD */
  maxCostUsd: number;
  /** Maximum total tokens */
  maxTokens?: number;
  /** Maximum requests */
  maxRequests?: number;
  /** Budget window in ms (e.g., per hour) */
  windowMs?: number;
  /** Action when budget is exceeded */
  onExceeded: 'kill' | 'warn' | 'fallback';
}

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time to wait before trying again (ms) */
  resetTimeoutMs: number;
  /** Number of successes needed to close circuit */
  successThreshold: number;
  /** Whether to use fallback when circuit is open */
  useFallback: boolean;
}

/** Checkpoint data for workflow state persistence */
export interface CheckpointData {
  /** Checkpoint ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Completed node results */
  completedNodes: Map<string, ExecutionResult>;
  /** Pending node IDs */
  pendingNodes: string[];
  /** Current workflow state */
  state: Record<string, unknown>;
  /** Total cost so far */
  totalCostUsd: number;
  /** Total tokens so far */
  totalTokens: number;
  /** Timestamp */
  timestamp: number;
}

/** A2A Agent Card for agent discovery */
export interface AgentCardData {
  /** Agent identity */
  id: string;
  name: string;
  description: string;
  /** Capabilities this agent offers */
  capabilities: string[];
  /** Input schema (JSON Schema) */
  inputSchema?: Record<string, unknown>;
  /** Output schema (JSON Schema) */
  outputSchema?: Record<string, unknown>;
  /** Authentication requirements */
  auth?: {
    type: 'none' | 'bearer' | 'api-key';
    headerName?: string;
  };
  /** Endpoint URL for A2A communication */
  endpoint?: string;
  /** Version */
  version: string;
}

/** Task result from A2A protocol */
export interface TaskResult {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output?: string;
  error?: string;
  artifacts?: Array<{
    name: string;
    mimeType: string;
    data: string;
  }>;
}

/** Top-level NEXUS configuration */
export interface NexusConfig {
  /** Agents in this orchestration */
  agents: AgentConfig[];
  /** Workflows defined */
  workflows: WorkflowConfig[];
  /** Global settings */
  settings?: {
    /** Enable execution dashboard on this port */
    dashboardPort?: number;
    /** Log level */
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    /** State storage directory */
    stateDir?: string;
    /** Enable A2A server on this port */
    a2aPort?: number;
  };
}

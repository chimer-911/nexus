import { EventEmitter } from 'events';
import { NexusConfig, AgentConfig, WorkflowConfig, ExecutionResult } from '../types';
import { Agent } from './agent';
import { Workflow } from './workflow';

/**
 * Nexus — The main orchestration engine.
 * Creates agents, defines workflows, and coordinates multi-agent execution.
 */
export class Nexus extends EventEmitter {
  private readonly agents: Map<string, Agent> = new Map();
  private readonly workflows: Map<string, Workflow> = new Map();
  private readonly config: NexusConfig;

  constructor(config: NexusConfig) {
    super();
    this.config = config;

    // Initialize agents
    for (const agentConfig of config.agents) {
      this.addAgent(agentConfig);
    }

    // Initialize workflows
    for (const workflowConfig of config.workflows) {
      this.addWorkflow(workflowConfig);
    }
  }

  /** Add a new agent to the orchestration */
  addAgent(config: AgentConfig): Agent {
    const agent = new Agent(config);

    // Forward agent events
    agent.on('execution:complete', (result) => this.emit('agent:execution', result));
    agent.on('execution:retry', (data) => this.emit('agent:retry', data));
    agent.on('execution:fallback', (data) => this.emit('agent:fallback', data));
    agent.on('budget:warning', (data) => this.emit('agent:budget-warning', data));
    agent.on('message:sent', (msg) => this.emit('agent:message', msg));

    this.agents.set(config.id, agent);
    return agent;
  }

  /** Remove an agent */
  removeAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /** Get an agent by ID */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /** List all agents */
  listAgents(): AgentConfig[] {
    return this.config.agents;
  }

  /** Add a new workflow */
  addWorkflow(config: WorkflowConfig): Workflow {
    const workflow = new Workflow(
      config,
      this.agents,
      this.config.settings?.stateDir
    );

    // Forward workflow events
    workflow.on('workflow:start', (data) => this.emit('workflow:start', data));
    workflow.on('workflow:complete', (data) => this.emit('workflow:complete', data));
    workflow.on('workflow:cancelled', (data) => this.emit('workflow:cancelled', data));
    workflow.on('workflow:timeout', (data) => this.emit('workflow:timeout', data));
    workflow.on('workflow:budget-exceeded', (data) => this.emit('workflow:budget-exceeded', data));
    workflow.on('node:start', (data) => this.emit('node:start', data));
    workflow.on('node:complete', (data) => this.emit('node:complete', data));
    workflow.on('node:error', (data) => this.emit('node:error', data));

    this.workflows.set(config.id, workflow);
    return workflow;
  }

  /** Execute a workflow by ID */
  async executeWorkflow(
    workflowId: string,
    context: Record<string, unknown> = {}
  ): Promise<Map<string, ExecutionResult>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow "${workflowId}" not found`);
    return workflow.execute(context);
  }

  /** Execute a single agent directly */
  async executeAgent(agentId: string, prompt: string): Promise<ExecutionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" not found`);
    return agent.execute(prompt);
  }

  /** Send a message between agents */
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    content: string
  ): Promise<ExecutionResult> {
    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(toAgentId);

    if (!fromAgent) throw new Error(`Source agent "${fromAgentId}" not found`);
    if (!toAgent) throw new Error(`Target agent "${toAgentId}" not found`);

    const message = fromAgent.sendMessage(toAgentId, content);
    return toAgent.receiveMessage(message);
  }

  /** Cancel a running workflow */
  cancelWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) workflow.cancel();
  }

  /** Get status of all agents */
  getAgentStatuses() {
    const statuses: Record<string, unknown> = {};
    for (const [id, agent] of this.agents) {
      statuses[id] = {
        name: agent.name,
        role: agent.role,
        budget: agent.getBudgetUsage(),
        circuit: agent.getCircuitState(),
      };
    }
    return statuses;
  }

  /** Get status of a workflow */
  getWorkflowStatus(workflowId: string) {
    return this.workflows.get(workflowId)?.getStatus();
  }

  /** Create a Nexus instance from a YAML/JSON config file */
  static fromConfig(config: NexusConfig): Nexus {
    return new Nexus(config);
  }
}

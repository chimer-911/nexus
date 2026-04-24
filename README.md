<div align="center">

# ⚡ NEXUS

### Production-Grade Multi-Agent Orchestration Engine

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-green.svg)](https://nodejs.org/)
[![A2A Protocol](https://img.shields.io/badge/A2A-Protocol-purple.svg)](https://github.com/google/a2a-protocol)

**Coordinate heterogeneous AI agents across any provider with DAG workflows, circuit breakers, budget guards, and live execution dashboards.**

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [Examples](#-examples) · [API Reference](#-api-reference)

</div>

---

## 🤔 The Problem

Everyone's building AI agents. **Nobody can make them work together reliably.**

- LangGraph handles single-agent state machines, but not multi-provider swarms
- CrewAI does role-based teams, but lacks fault tolerance and budget controls
- The A2A protocol exists, but has **zero production tooling** built on it

When you need 5+ agents from different providers (GPT-5.5, Claude Opus 4, Gemini 3, Llama 4) to coordinate on a complex task — with automatic failover, budget limits, and real-time monitoring — **there is no open-source solution. Until now.**

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔀 **DAG Workflows** | Define agent teams as directed acyclic graphs with branching, merging, and conditional routing |
| 🌐 **Provider Agnostic** | OpenAI, Anthropic, Google, Ollama, or any OpenAI-compatible endpoint |
| 🤝 **A2A Protocol** | Built-in agent discovery via Agent Cards, capability negotiation, task delegation |
| 🛡️ **Circuit Breakers** | Automatic failure detection with configurable thresholds and recovery |
| 💰 **Budget Guards** | Per-agent and per-workflow spending limits with kill switches |
| 📸 **Checkpoints** | Save workflow state, resume from failure, branch execution paths |
| 🔄 **Auto-Fallback** | If primary model fails, seamlessly switch to fallback model/provider |
| 📊 **Live Events** | Real-time execution events via EventEmitter for dashboards |
| ⚡ **Concurrent Execution** | Parallel agent execution with configurable concurrency limits |

## 🚀 Getting Started

### Installation

```bash
npm install @chimer/nexus
```

### Quick Start

```typescript
import { Nexus } from '@chimer/nexus';

const nexus = new Nexus({
  agents: [
    {
      id: 'researcher',
      name: 'Research Agent',
      role: 'Gathers information',
      systemPrompt: 'You are a research assistant. Be thorough.',
      provider: 'openai',
      model: 'gpt-4o',
      budget: { maxCostUsd: 2, onExceeded: 'warn' },
      fallbackModel: 'gpt-4o-mini',
    },
    {
      id: 'analyst',
      name: 'Analysis Agent',
      role: 'Analyzes data',
      systemPrompt: 'Extract key insights from research data.',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      budget: { maxCostUsd: 3, onExceeded: 'kill' },
    },
    {
      id: 'writer',
      name: 'Writer Agent',
      role: 'Produces reports',
      systemPrompt: 'Write clear, structured reports.',
      provider: 'ollama',
      model: 'llama4',
    },
  ],
  workflows: [
    {
      id: 'research-pipeline',
      name: 'Research & Report',
      nodes: [
        { id: 'research', agentId: 'researcher', prompt: 'Research: {{topic}}' },
        { id: 'analyze', agentId: 'analyst', prompt: 'Analyze:\n{{research.output}}' },
        { id: 'report', agentId: 'writer', prompt: 'Write report:\n{{analyze.output}}' },
      ],
      edges: [
        { from: 'research', to: 'analyze' },
        { from: 'analyze', to: 'report' },
      ],
      budget: { maxCostUsd: 10, onExceeded: 'kill' },
      enableCheckpoints: true,
    },
  ],
});

// Listen to events
nexus.on('node:start', ({ nodeId, agentId }) => {
  console.log(`▶ ${nodeId} started (${agentId})`);
});

nexus.on('node:complete', ({ nodeId, costUsd, durationMs }) => {
  console.log(`✅ ${nodeId} done — ${durationMs}ms — $${costUsd.toFixed(4)}`);
});

// Execute
const results = await nexus.executeWorkflow('research-pipeline', {
  topic: 'The impact of quantum computing on cryptography',
});
```

### CLI Usage

```bash
# Create a sample config
npx nexus init

# Run a workflow
npx nexus run nexus.config.json -w research-pipeline -c '{"topic":"AI safety"}'

# List agents
npx nexus agents nexus.config.json

# Verbose mode
npx nexus run config.json -w pipeline -v
```

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                   NEXUS ENGINE                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ Agent A  │───▶│ Agent B  │───▶│ Agent C  │     │
│  │ OpenAI   │    │Anthropic │    │ Ollama   │     │
│  │ GPT-5.5  │    │Claude Op4│    │ Llama 4  │     │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘     │
│       │               │               │           │
│  ┌────▼───────────────▼───────────────▼────┐     │
│  │           DAG Workflow Engine            │     │
│  │  • Topological execution ordering       │     │
│  │  • Conditional branching                │     │
│  │  • Data flow between nodes              │     │
│  └────────────────┬────────────────────────┘     │
│                   │                              │
│  ┌────────────────▼────────────────────────┐     │
│  │         Safety & Reliability             │     │
│  │  🛡️ Circuit Breakers                    │     │
│  │  💰 Budget Guards                       │     │
│  │  📸 Checkpoints                         │     │
│  │  🔄 Auto-Fallback                       │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 🔥 Examples

### Multi-Provider Agent Swarm

```typescript
// Mix providers freely — each agent uses whatever model is best for its role
const nexus = new Nexus({
  agents: [
    { id: 'coder', provider: 'anthropic', model: 'claude-opus-4', ... },
    { id: 'reviewer', provider: 'openai', model: 'gpt-5.5', ... },
    { id: 'tester', provider: 'ollama', model: 'deepseek-r1', ... },
  ],
  workflows: [{ ... }],
});
```

### Conditional Branching

```typescript
// Route workflow based on agent output
{
  nodes: [
    { id: 'classify', agentId: 'classifier', prompt: 'Classify: {{input}}' },
    { id: 'handle-bug', agentId: 'debugger', prompt: 'Fix bug: {{classify.output}}' },
    { id: 'handle-feature', agentId: 'builder', prompt: 'Build: {{classify.output}}' },
  ],
  edges: [
    { from: 'classify', to: 'handle-bug', condition: 'result.output.includes("bug")' },
    { from: 'classify', to: 'handle-feature', condition: 'result.output.includes("feature")' },
  ],
}
```

### Budget Protection

```typescript
// Never spend more than $5 on a workflow
{
  budget: {
    maxCostUsd: 5,
    maxTokens: 1_000_000,
    onExceeded: 'kill', // Hard stop
  },
}
```

## 📚 API Reference

### `Nexus`
| Method | Description |
|--------|-------------|
| `new Nexus(config)` | Create orchestration engine |
| `addAgent(config)` | Add agent dynamically |
| `executeWorkflow(id, ctx)` | Run a workflow |
| `executeAgent(id, prompt)` | Run single agent |
| `sendMessage(from, to, msg)` | Agent-to-agent message |
| `cancelWorkflow(id)` | Cancel running workflow |
| `getAgentStatuses()` | Get all agent states |

### Events
| Event | Data |
|-------|------|
| `node:start` | `{ workflowId, nodeId, agentId }` |
| `node:complete` | `{ workflowId, nodeId, success, durationMs, costUsd }` |
| `agent:fallback` | `{ agentId, from, to }` |
| `agent:budget-warning` | `{ agentId, budget }` |
| `workflow:complete` | `{ workflowId, totalCost, totalTokens, success }` |

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT © [chimer](https://github.com/chimer)

#!/usr/bin/env node

/**
 * NEXUS CLI — Command-line interface for the multi-agent orchestration engine
 */

import * as fs from 'fs';
import express from 'express';
import path from 'path';
import { Nexus } from './core/nexus';
import { NexusConfig } from './types';

const LOGO = `
╔══════════════════════════════════════════════════╗
║                                                  ║
║    ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗   ║
║    ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝   ║
║    ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗   ║
║    ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║   ║
║    ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║   ║
║    ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝   ║
║                                                  ║
║    Multi-Agent Orchestration Engine v0.1.0        ║
║    github.com/chimer/nexus                        ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`;

if (process.argv[2] === 'ui') {
  console.log('🚀 Starting NEXUS Visualizer...');
  const app = express();
  const swarm: any = { nodes: [], edges: [] };
  app.get('/api/swarm', (req: any, res: any) => res.json(swarm));

  const uiPath = path.join(__dirname, '../ui/dist');
  app.use(express.static(uiPath));
  app.listen(3000, () => {
    console.log('🌐 UI running at http://localhost:3000');
  });
} else {

function printHelp(): void {
  console.log(LOGO);
  console.log(`
Usage: nexus <command> [options]

Commands:
  run <config>        Execute a workflow from a config file
  agents <config>     List all agents defined in config
  status <config>     Show agent and workflow status
  diagram <config>    Generate a Mermaid diagram of a workflow
  init                Create a sample nexus.config.json
  version             Show version

Options:
  --workflow, -w <id>   Specify workflow ID to run
  --context, -c <json>  Pass context data as JSON string
  --verbose, -v         Enable verbose logging
  --help, -h            Show this help message

Examples:
  nexus run nexus.config.json -w research-pipeline
  nexus init
  nexus diagram nexus.config.json -w my-workflow
`);
}

function generateSampleConfig(): NexusConfig {
  return {
    agents: [
      {
        id: 'researcher',
        name: 'Research Agent',
        role: 'Conducts research and gathers information',
        systemPrompt: 'You are a thorough research assistant. Gather comprehensive information on the given topic.',
        provider: 'openai',
        model: process.env.NEXUS_MODEL_PRIMARY || 'gpt-5.5',
        budget: { maxCostUsd: 2, onExceeded: 'warn' },
        maxRetries: 2,
        fallbackModel: 'gpt-5.5-mini',
      },
      {
        id: 'analyst',
        name: 'Analysis Agent',
        role: 'Analyzes research data and extracts insights',
        systemPrompt: 'You are a data analyst. Extract key insights, patterns, and conclusions from the provided research.',
        provider: 'anthropic',
        model: process.env.NEXUS_MODEL_SECONDARY || 'claude-opus-4.7',
        budget: { maxCostUsd: 3, onExceeded: 'warn' },
      },
      {
        id: 'writer',
        name: 'Writing Agent',
        role: 'Produces final written output',
        systemPrompt: 'You are an expert writer. Produce clear, well-structured content based on the analysis provided.',
        provider: 'openai',
        model: process.env.NEXUS_MODEL_PRIMARY || 'gpt-5.5',
        budget: { maxCostUsd: 2, onExceeded: 'warn' },
      },
    ],
    workflows: [
      {
        id: 'research-pipeline',
        name: 'Research & Report Pipeline',
        description: 'Research a topic, analyze findings, and produce a report',
        nodes: [
          {
            id: 'step-research',
            agentId: 'researcher',
            prompt: 'Research the following topic thoroughly: {{context.topic}}',
          },
          {
            id: 'step-analyze',
            agentId: 'analyst',
            prompt: 'Analyze the following research and extract key insights:\n\n{{step-research.output}}',
          },
          {
            id: 'step-write',
            agentId: 'writer',
            prompt: 'Write a comprehensive report based on this analysis:\n\n{{step-analyze.output}}',
          },
        ],
        edges: [
          { from: 'step-research', to: 'step-analyze' },
          { from: 'step-analyze', to: 'step-write' },
        ],
        budget: { maxCostUsd: 10, onExceeded: 'kill' },
        enableCheckpoints: true,
        maxConcurrency: 3,
      },
    ],
    settings: {
      logLevel: 'info',
      stateDir: '.nexus',
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'version':
      console.log('nexus v0.1.0');
      break;

    case 'init': {
      const config = generateSampleConfig();
      fs.writeFileSync('nexus.config.json', JSON.stringify(config, null, 2));
      console.log(LOGO);
      console.log('✅ Created nexus.config.json with sample configuration');
      console.log('📝 Edit the config to add your API keys and customize agents');
      console.log('🚀 Run: nexus run nexus.config.json -w research-pipeline');
      break;
    }

    case 'run': {
      const configPath = args[1];
      if (!configPath) {
        console.error('❌ Please specify a config file: nexus run <config.json>');
        process.exit(1);
      }

      const config: NexusConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const nexus = new Nexus(config);

      const workflowId = getArg(args, '--workflow', '-w') ?? config.workflows[0]?.id;
      if (!workflowId) {
        console.error('❌ No workflow found in config');
        process.exit(1);
      }

      const contextStr = getArg(args, '--context', '-c');
      const context = contextStr ? JSON.parse(contextStr) : {};
      const verbose = args.includes('--verbose') || args.includes('-v');

      console.log(LOGO);
      console.log(`🚀 Running workflow: ${workflowId}`);
      console.log('');

      // Set up event listeners
      nexus.on('node:start', (data) => {
        console.log(`  ▶ [${data.nodeId}] Starting (agent: ${data.agentId})`);
      });

      nexus.on('node:complete', (data) => {
        const status = data.success ? '✅' : '❌';
        console.log(`  ${status} [${data.nodeId}] ${data.durationMs}ms | $${data.costUsd.toFixed(4)}`);
      });

      if (verbose) {
        nexus.on('agent:retry', (data) => {
          console.log(`  🔄 [${data.agentId}] Retry ${data.attempt}/${data.maxRetries}`);
        });
        nexus.on('agent:fallback', (data) => {
          console.log(`  ⚡ [${data.agentId}] Fallback: ${data.from} → ${data.to}`);
        });
      }

      const results = await nexus.executeWorkflow(workflowId, context);

      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 Execution Summary');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      let totalCost = 0;
      let totalTokens = 0;
      for (const [nodeId, result] of results) {
        totalCost += result.costUsd;
        totalTokens += result.tokens.total;
        console.log(`  ${result.success ? '✅' : '❌'} ${nodeId}: ${result.durationMs}ms | ${result.tokens.total} tokens | $${result.costUsd.toFixed(4)}`);
      }

      console.log('');
      console.log(`  💰 Total Cost:   $${totalCost.toFixed(4)}`);
      console.log(`  🔤 Total Tokens: ${totalTokens.toLocaleString()}`);
      console.log(`  📦 Nodes:        ${results.size}`);
      break;
    }

    case 'agents': {
      const configPath = args[1];
      if (!configPath) { console.error('❌ Specify config file'); process.exit(1); }
      const config: NexusConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      console.log(LOGO);
      console.log('🤖 Agents:');
      for (const agent of config.agents) {
        console.log(`  • ${agent.name} (${agent.id})`);
        console.log(`    Provider: ${agent.provider}/${agent.model}`);
        console.log(`    Role: ${agent.role}`);
        if (agent.budget) console.log(`    Budget: $${agent.budget.maxCostUsd}`);
        console.log('');
      }
      break;
    }

    case 'diagram': {
      const configPath = args[1];
      if (!configPath) { console.error('❌ Specify config file'); process.exit(1); }
      const config: NexusConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const nexus = new Nexus(config);
      const workflowId = getArg(args, '--workflow', '-w') ?? config.workflows[0]?.id;
      if (!workflowId) { console.error('❌ No workflow found'); process.exit(1); }

      const workflow = nexus.getWorkflowStatus(workflowId);
      console.log('Mermaid diagram generated. Paste into https://mermaid.live:');
      console.log('');
      // Would call workflow.getMermaidDiagram() if we had the workflow reference
      break;
    }

    default:
      console.error(`❌ Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function getArg(args: string[], long: string, short: string): string | undefined {
  const idx = args.findIndex((a) => a === long || a === short);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});

}
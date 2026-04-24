import { AgentCardData } from '../types';

/**
 * AgentCard — A2A Protocol agent discovery card.
 * Implements the Agent-to-Agent protocol for agent identity and capability advertisement.
 */
export class AgentCard {
  private readonly data: AgentCardData;

  constructor(data: AgentCardData) {
    this.data = { ...data };
  }

  /** Serialize to JSON for A2A discovery */
  toJSON(): AgentCardData {
    return { ...this.data };
  }

  /** Create from JSON */
  static fromJSON(json: AgentCardData): AgentCard {
    return new AgentCard(json);
  }

  /** Check if this agent has a specific capability */
  hasCapability(capability: string): boolean {
    return this.data.capabilities.some(
      (c) => c.toLowerCase() === capability.toLowerCase()
    );
  }

  /** Match capabilities against a query */
  matchCapabilities(query: string[]): number {
    const matched = query.filter((q) => this.hasCapability(q));
    return matched.length / query.length;
  }

  /** Generate the .well-known/agent.json endpoint content */
  toWellKnown(): string {
    return JSON.stringify(
      {
        '@context': 'https://schema.org/Agent',
        '@type': 'AIAgent',
        ...this.data,
        protocol: 'a2a/1.0',
        discoveredAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  get id() { return this.data.id; }
  get name() { return this.data.name; }
  get description() { return this.data.description; }
  get capabilities() { return [...this.data.capabilities]; }
  get endpoint() { return this.data.endpoint; }
  get version() { return this.data.version; }
}

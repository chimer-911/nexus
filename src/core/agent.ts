import { EventEmitter } from 'events';
import {
  AgentConfig,
  AgentMessage,
  BudgetConfig,
  CircuitBreakerConfig,
  ExecutionResult,
  ProviderConfig,
  TokenUsage,
} from '../types';
import { CircuitBreaker } from './circuit-breaker';
import { BudgetGuard } from './budget-guard';

/**
 * Agent — A single AI agent backed by any LLM provider.
 * Handles retries, fallback, circuit breaking, and budget enforcement.
 */
export class Agent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly role: string;
  private readonly config: AgentConfig;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly budgetGuard: BudgetGuard;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(config: AgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.config = config;

    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker ?? {
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        successThreshold: 1,
        useFallback: true,
      }
    );

    this.budgetGuard = new BudgetGuard(
      config.budget ?? {
        maxCostUsd: 10,
        maxTokens: 500000,
        maxRequests: 100,
        onExceeded: 'warn',
      }
    );
  }

  /**
   * Execute a task with this agent
   */
  async execute(prompt: string, context?: Record<string, unknown>): Promise<ExecutionResult> {
    const startTime = Date.now();
    const nodeId = (context?.nodeId as string) ?? 'direct';

    // Check budget before executing
    if (this.budgetGuard.isExceeded()) {
      const action = this.config.budget?.onExceeded ?? 'warn';
      if (action === 'kill') {
        return this.createFailureResult(nodeId, 'Budget exceeded — agent killed', startTime);
      }
      this.emit('budget:warning', { agentId: this.id, budget: this.budgetGuard.getUsage() });
    }

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      if (this.config.fallbackModel && this.circuitBreaker.config.useFallback) {
        return this.executeWithFallback(prompt, nodeId, startTime);
      }
      return this.createFailureResult(nodeId, 'Circuit breaker open — agent unavailable', startTime);
    }

    try {
      const result = await this.callProvider(prompt, this.config.provider, this.config.model);
      this.circuitBreaker.recordSuccess();
      this.budgetGuard.recordUsage(result.tokens, result.costUsd);

      const execResult: ExecutionResult = {
        nodeId,
        agentId: this.id,
        success: true,
        output: result.content,
        tokens: result.tokens,
        costUsd: result.costUsd,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        modelUsed: this.config.model,
        providerUsed: this.config.provider,
        usedFallback: false,
      };

      this.emit('execution:complete', execResult);
      return execResult;
    } catch (error) {
      this.circuitBreaker.recordFailure();

      // Retry logic
      const maxRetries = this.config.maxRetries ?? 2;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.emit('execution:retry', { agentId: this.id, attempt, maxRetries });
          await this.delay(Math.pow(2, attempt) * 500); // Exponential backoff

          const result = await this.callProvider(prompt, this.config.provider, this.config.model);
          this.circuitBreaker.recordSuccess();
          this.budgetGuard.recordUsage(result.tokens, result.costUsd);

          return {
            nodeId,
            agentId: this.id,
            success: true,
            output: result.content,
            tokens: result.tokens,
            costUsd: result.costUsd,
            durationMs: Date.now() - startTime,
            timestamp: Date.now(),
            modelUsed: this.config.model,
            providerUsed: this.config.provider,
            usedFallback: false,
          };
        } catch {
          this.circuitBreaker.recordFailure();
        }
      }

      // Try fallback if available
      if (this.config.fallbackModel) {
        return this.executeWithFallback(prompt, nodeId, startTime);
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      return this.createFailureResult(nodeId, errMsg, startTime);
    }
  }

  /**
   * Execute with fallback provider/model
   */
  private async executeWithFallback(
    prompt: string,
    nodeId: string,
    startTime: number
  ): Promise<ExecutionResult> {
    const fbProvider = this.config.fallbackProvider ?? this.config.provider;
    const fbModel = this.config.fallbackModel!;

    try {
      this.emit('execution:fallback', {
        agentId: this.id,
        from: `${this.config.provider}/${this.config.model}`,
        to: `${fbProvider}/${fbModel}`,
      });

      const result = await this.callProvider(prompt, fbProvider, fbModel);
      this.budgetGuard.recordUsage(result.tokens, result.costUsd);

      return {
        nodeId,
        agentId: this.id,
        success: true,
        output: result.content,
        tokens: result.tokens,
        costUsd: result.costUsd,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        modelUsed: fbModel,
        providerUsed: fbProvider,
        usedFallback: true,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return this.createFailureResult(nodeId, `Fallback also failed: ${errMsg}`, startTime);
    }
  }

  /**
   * Call the LLM provider
   */
  private async callProvider(
    prompt: string,
    provider: string,
    model: string
  ): Promise<{ content: string; tokens: TokenUsage; costUsd: number }> {
    const messages = [
      { role: 'system', content: this.config.systemPrompt },
      ...this.conversationHistory,
      { role: 'user', content: prompt },
    ];

    const providerConfig = this.config.providerConfig ?? {};
    const temperature = this.config.temperature ?? 0.7;
    const maxTokens = this.config.maxTokens ?? 4096;

    switch (provider) {
      case 'openai':
        return this.callOpenAI(messages, model, providerConfig, temperature, maxTokens);
      case 'anthropic':
        return this.callAnthropic(messages, model, providerConfig, temperature, maxTokens);
      case 'ollama':
        return this.callOllama(messages, model, providerConfig, temperature, maxTokens);
      default:
        return this.callGeneric(messages, model, providerConfig, temperature, maxTokens);
    }
  }

  private async callOpenAI(
    messages: Array<{ role: string; content: string }>,
    model: string,
    config: ProviderConfig,
    temperature: number,
    maxTokens: number
  ): Promise<{ content: string; tokens: TokenUsage; costUsd: number }> {
    const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;

    if (!apiKey) throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY env var.');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...config.headers,
    };
    if (config.orgId) headers['OpenAI-Organization'] = config.orgId;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 120000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const tokens: TokenUsage = {
      prompt: data.usage.prompt_tokens,
      completion: data.usage.completion_tokens,
      total: data.usage.total_tokens,
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      tokens,
      costUsd: this.estimateCost(model, tokens),
    };
  }

  private async callAnthropic(
    messages: Array<{ role: string; content: string }>,
    model: string,
    config: ProviderConfig,
    temperature: number,
    maxTokens: number
  ): Promise<{ content: string; tokens: TokenUsage; costUsd: number }> {
    const baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;

    if (!apiKey) throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY env var.');

    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2024-10-22',
        ...config.headers,
      },
      body: JSON.stringify({
        model,
        system: systemMsg,
        messages: nonSystemMessages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 120000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const tokens: TokenUsage = {
      prompt: data.usage.input_tokens,
      completion: data.usage.output_tokens,
      total: data.usage.input_tokens + data.usage.output_tokens,
    };

    const content = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    return { content, tokens, costUsd: this.estimateCost(model, tokens) };
  }

  private async callOllama(
    messages: Array<{ role: string; content: string }>,
    model: string,
    config: ProviderConfig,
    temperature: number,
    _maxTokens: number
  ): Promise<{ content: string; tokens: TokenUsage; costUsd: number }> {
    const baseUrl = config.baseUrl ?? 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.headers },
      body: JSON.stringify({ model, messages, stream: false, options: { temperature } }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 300000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      message: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const tokens: TokenUsage = {
      prompt: data.prompt_eval_count ?? 0,
      completion: data.eval_count ?? 0,
      total: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
    };

    return { content: data.message.content, tokens, costUsd: 0 }; // Local = free
  }

  private async callGeneric(
    messages: Array<{ role: string; content: string }>,
    model: string,
    config: ProviderConfig,
    temperature: number,
    maxTokens: number
  ): Promise<{ content: string; tokens: TokenUsage; costUsd: number }> {
    const baseUrl = config.baseUrl;
    if (!baseUrl) throw new Error('Generic provider requires baseUrl in providerConfig');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        ...config.headers,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(config.timeoutMs ?? 120000),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const tokens: TokenUsage = {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      tokens,
      costUsd: this.estimateCost(model, tokens),
    };
  }

  /**
   * Estimate cost based on model and token usage
   */
  private estimateCost(model: string, tokens: TokenUsage): number {
    // Approximate pricing per 1M tokens (input/output) as of April 2026
    const pricing: Record<string, [number, number]> = {
      'gpt-5.5': [2.0, 8.0],
      'gpt-5': [1.5, 6.0],
      'gpt-4.1': [1.0, 4.0],
      'gpt-4o': [0.5, 1.5],
      'gpt-4o-mini': [0.15, 0.6],
      'claude-opus-4': [3.0, 15.0],
      'claude-sonnet-4': [1.0, 5.0],
      'claude-haiku-3.5': [0.25, 1.25],
      'gemini-3-pro': [0.5, 1.5],
      'gemini-2.5-flash': [0.1, 0.4],
      'deepseek-r1': [0.14, 2.19],
      'llama-4-maverick': [0.2, 0.6],
    };

    const modelKey = Object.keys(pricing).find((k) => model.includes(k));
    if (!modelKey) return 0;

    const [inputRate, outputRate] = pricing[modelKey];
    return (tokens.prompt * inputRate + tokens.completion * outputRate) / 1_000_000;
  }

  /** Send a message to another agent */
  sendMessage(to: string, content: string, type: AgentMessage['type'] = 'task'): AgentMessage {
    const message: AgentMessage = {
      from: this.id,
      to,
      content,
      type,
      correlationId: this.generateId(),
      timestamp: Date.now(),
    };
    this.emit('message:sent', message);
    return message;
  }

  /** Receive and process a message from another agent */
  async receiveMessage(message: AgentMessage): Promise<ExecutionResult> {
    this.emit('message:received', message);
    return this.execute(message.content, { nodeId: `msg-${message.correlationId}` });
  }

  /** Reset conversation history */
  resetHistory(): void {
    this.conversationHistory = [];
  }

  /** Get budget usage */
  getBudgetUsage() {
    return this.budgetGuard.getUsage();
  }

  /** Get circuit breaker state */
  getCircuitState() {
    return this.circuitBreaker.getState();
  }

  private createFailureResult(nodeId: string, error: string, startTime: number): ExecutionResult {
    return {
      nodeId,
      agentId: this.id,
      success: false,
      output: '',
      error,
      tokens: { prompt: 0, completion: 0, total: 0 },
      costUsd: 0,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      modelUsed: this.config.model,
      providerUsed: this.config.provider,
      usedFallback: false,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

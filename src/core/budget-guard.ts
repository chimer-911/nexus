import { BudgetConfig, TokenUsage } from '../types';

/**
 * BudgetGuard — Enforces spending limits on AI agent execution.
 * Prevents runaway costs from recursive loops or expensive model calls.
 */
export class BudgetGuard {
  private readonly config: BudgetConfig;
  private totalCostUsd = 0;
  private totalTokens = 0;
  private totalRequests = 0;
  private windowStart = Date.now();
  private history: Array<{ cost: number; tokens: number; timestamp: number }> = [];

  constructor(config: BudgetConfig) {
    this.config = config;
  }

  /** Record usage from an execution */
  recordUsage(tokens: TokenUsage, costUsd: number): void {
    this.checkWindow();
    this.totalCostUsd += costUsd;
    this.totalTokens += tokens.total;
    this.totalRequests++;
    this.history.push({ cost: costUsd, tokens: tokens.total, timestamp: Date.now() });
  }

  /** Check if budget has been exceeded */
  isExceeded(): boolean {
    this.checkWindow();
    if (this.totalCostUsd >= this.config.maxCostUsd) return true;
    if (this.config.maxTokens && this.totalTokens >= this.config.maxTokens) return true;
    if (this.config.maxRequests && this.totalRequests >= this.config.maxRequests) return true;
    return false;
  }

  /** Get current usage statistics */
  getUsage() {
    this.checkWindow();
    return {
      costUsd: this.totalCostUsd,
      maxCostUsd: this.config.maxCostUsd,
      costPercent: (this.totalCostUsd / this.config.maxCostUsd) * 100,
      tokens: this.totalTokens,
      maxTokens: this.config.maxTokens,
      requests: this.totalRequests,
      maxRequests: this.config.maxRequests,
      windowStart: this.windowStart,
      isExceeded: this.isExceeded(),
    };
  }

  /** Get spending rate (USD per minute) */
  getSpendingRate(): number {
    const elapsed = (Date.now() - this.windowStart) / 60000; // minutes
    return elapsed > 0 ? this.totalCostUsd / elapsed : 0;
  }

  /** Estimate time until budget is exhausted at current rate */
  estimateTimeToExhaustion(): number | null {
    const rate = this.getSpendingRate();
    if (rate <= 0) return null;
    const remaining = this.config.maxCostUsd - this.totalCostUsd;
    return remaining / rate; // minutes
  }

  /** Reset budget counters */
  reset(): void {
    this.totalCostUsd = 0;
    this.totalTokens = 0;
    this.totalRequests = 0;
    this.windowStart = Date.now();
    this.history = [];
  }

  /** Check if the budget window has expired and reset if so */
  private checkWindow(): void {
    if (this.config.windowMs && Date.now() - this.windowStart >= this.config.windowMs) {
      this.reset();
    }
  }
}

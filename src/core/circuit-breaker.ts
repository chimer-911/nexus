import { CircuitBreakerConfig } from '../types';

type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit Breaker — Prevents cascading failures when AI providers go down.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is failing, requests are blocked
 * - HALF-OPEN: Testing if provider has recovered
 */
export class CircuitBreaker {
  public readonly config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private stateHistory: Array<{ state: CircuitState; timestamp: number }> = [];

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.recordStateChange('closed');
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      // Check if enough time has passed to try again
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.transitionTo('half-open');
        return true;
      }
      return false;
    }
    // half-open: allow one request through
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
    if (this.state === 'closed') {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.transitionTo('open');
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  getState(): { state: CircuitState; failureCount: number; history: Array<{ state: CircuitState; timestamp: number }> } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      history: [...this.stateHistory],
    };
  }

  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.transitionTo('closed');
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    if (newState === 'closed') {
      this.failureCount = 0;
      this.successCount = 0;
    }
    if (newState === 'half-open') {
      this.successCount = 0;
    }
    this.recordStateChange(newState);
  }

  private recordStateChange(state: CircuitState): void {
    this.stateHistory.push({ state, timestamp: Date.now() });
    if (this.stateHistory.length > 100) {
      this.stateHistory = this.stateHistory.slice(-50);
    }
  }
}

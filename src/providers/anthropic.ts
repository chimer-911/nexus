/** Anthropic Provider — Claude Opus 4, Sonnet 4, Haiku 3.5 */
export class AnthropicProvider {
  static readonly models = ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3.5'] as const;
  static readonly defaultModel = 'claude-sonnet-4';
  static isSupported(model: string): boolean {
    return this.models.some((m) => model.includes(m));
  }
}

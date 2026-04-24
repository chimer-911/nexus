/** OpenAI Provider — GPT-5.5, GPT-5, GPT-4o, GPT-4o-mini */
export class OpenAIProvider {
  static readonly models = ['gpt-5.5', 'gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'] as const;
  static readonly defaultModel = 'gpt-4o';
  static isSupported(model: string): boolean {
    return this.models.some((m) => model.includes(m));
  }
}

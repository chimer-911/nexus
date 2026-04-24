/** Ollama Provider — Local models (Llama 4, DeepSeek, Qwen, etc.) */
export class OllamaProvider {
  static readonly defaultBaseUrl = 'http://localhost:11434';
  static readonly defaultModel = 'llama4';
  static isSupported(_model: string): boolean {
    return true; // Ollama supports any GGUF model
  }
}

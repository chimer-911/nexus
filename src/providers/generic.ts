/** Generic Provider — Any OpenAI-compatible API endpoint */
export class GenericProvider {
  static isSupported(_model: string): boolean {
    return true;
  }
}

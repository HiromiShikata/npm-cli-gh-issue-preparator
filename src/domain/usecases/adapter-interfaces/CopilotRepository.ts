export interface CopilotRepository {
  run(prompt: string, model: 'gpt-5-mini', processTitle: string): void;
}

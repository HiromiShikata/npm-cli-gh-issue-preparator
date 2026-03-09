import { WebhookRepository } from '../../domain/usecases/adapter-interfaces/WebhookRepository';

export class FetchWebhookRepository implements WebhookRepository {
  sendGetRequest = async (url: string): Promise<void> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Webhook request failed with status ${response.status}: ${response.statusText}`,
      );
    }
  };
}

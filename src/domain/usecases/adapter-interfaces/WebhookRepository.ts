export interface WebhookRepository {
  sendGetRequest(url: string): Promise<void>;
}

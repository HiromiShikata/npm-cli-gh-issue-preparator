import { FetchWebhookRepository } from './FetchWebhookRepository';

describe('FetchWebhookRepository', () => {
  let repository: FetchWebhookRepository;
  const originalFetch = global.fetch;

  beforeEach(() => {
    repository = new FetchWebhookRepository();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should send GET request to the provided URL', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = mockFetch;

    await repository.sendGetRequest('https://example.com/webhook');

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/webhook');
  });

  it('should throw error when response is not ok', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    global.fetch = mockFetch;

    await expect(
      repository.sendGetRequest('https://example.com/webhook'),
    ).rejects.toThrow(
      'Webhook request failed with status 500: Internal Server Error',
    );
  });

  it('should propagate network errors', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    await expect(
      repository.sendGetRequest('https://example.com/webhook'),
    ).rejects.toThrow('Network error');
  });
});

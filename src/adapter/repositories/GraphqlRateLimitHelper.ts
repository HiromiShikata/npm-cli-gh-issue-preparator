export type GraphqlError = {
  type?: string;
  code?: string;
  message?: unknown;
};

export const isRateLimitError = (errors: GraphqlError[]): boolean =>
  errors.some(
    (e) =>
      e.type === 'RATE_LIMIT' ||
      e.code === 'graphql_rate_limit' ||
      (typeof e.message === 'string' &&
        e.message.toLowerCase().includes('rate limit')),
  );

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

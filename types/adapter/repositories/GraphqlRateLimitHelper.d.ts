export type GraphqlError = {
    type?: string;
    code?: string;
    message?: unknown;
};
export declare const isRateLimitError: (errors: GraphqlError[]) => boolean;
export declare const defaultSleep: (ms: number) => Promise<void>;
//# sourceMappingURL=GraphqlRateLimitHelper.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSleep = exports.isRateLimitError = void 0;
const isRateLimitError = (errors) => errors.some((e) => e.type === 'RATE_LIMIT' ||
    e.code === 'graphql_rate_limit' ||
    (typeof e.message === 'string' &&
        e.message.toLowerCase().includes('rate limit')));
exports.isRateLimitError = isRateLimitError;
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.defaultSleep = defaultSleep;
//# sourceMappingURL=GraphqlRateLimitHelper.js.map
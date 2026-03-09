"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchWebhookRepository = void 0;
class FetchWebhookRepository {
    constructor() {
        this.sendGetRequest = async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Webhook request failed with status ${response.status}: ${response.statusText}`);
            }
        };
    }
}
exports.FetchWebhookRepository = FetchWebhookRepository;
//# sourceMappingURL=FetchWebhookRepository.js.map
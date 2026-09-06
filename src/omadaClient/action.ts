import type { OmadaApiResponse } from '../types/index.js';

import type { RequestHandler } from './request.js';
import type { SiteOperations } from './site.js';

/**
 * Device and client action operations for the Omada API.
 * Covers reboot, adopt, block, and unblock actions.
 */
export class ActionOperations {
    constructor(
        private readonly request: RequestHandler,
        private readonly site: SiteOperations,
        private readonly buildPath: (path: string, version?: string) => string
    ) {}

    /**
     * Reboot a device by MAC address (v1 API).
     */
    public async rebootDevice(deviceMac: string, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/devices/${encodeURIComponent(deviceMac)}/reboot`);
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, {});
        return this.request.ensureSuccess(response);
    }

    /**
     * Adopt a device by MAC address (v1 API).
     */
    public async adoptDevice(
        deviceMac: string,
        siteId?: string,
        credentials?: { username?: string; password?: string }
    ): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/devices/${encodeURIComponent(deviceMac)}/start-adopt`);
        // AdoptDeviceRequest is { username?, password? } - the DEVICE account,
        // needed when a device still holds a binding to a previous controller
        // (the "Managed by Others" state). Not a macs array; the old code sent
        // one to /cmd/adopts, a path that does not exist.
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, credentials ?? {});
        return this.request.ensureSuccess(response);
    }

    /**
     * Block a client by MAC address (v1 API).
     */
    public async blockClient(clientMac: string, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/clients/${encodeURIComponent(clientMac)}/block`);
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, {});
        return this.request.ensureSuccess(response);
    }

    /**
     * Unblock a client by MAC address (v1 API).
     */
    public async unblockClient(clientMac: string, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/clients/${encodeURIComponent(clientMac)}/unblock`);
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, {});
        return this.request.ensureSuccess(response);
    }

    /**
     * Reconnect a client by MAC address (v1 API).
     */
    public async reconnectClient(clientMac: string, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/clients/${encodeURIComponent(clientMac)}/reconnect`);
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, {});
        return this.request.ensureSuccess(response);
    }

    /**
     * Update a client's settings (v1 API).
     */
    public async updateClient(clientMac: string, data: Record<string, unknown>, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const results: Record<string, unknown> = {};

        // The Omada Open API has no single "update client" endpoint. Each
        // attribute has its own, and the path this method used to PATCH
        // (/clients/{mac}) only supports GET and DELETE - so every call
        // returned 405 Method Not Allowed. Verified against the bundled
        // OpenAPI specs in docs/openapi/.
        const { name, rateLimitEnable, upLimit, downLimit, ...rest } = data as {
            name?: string;
            rateLimitEnable?: boolean;
            upLimit?: number;
            downLimit?: number;
            [k: string]: unknown;
        };

        if (name !== undefined) {
            // PATCH /sites/{siteId}/clients/{clientMac}/name  body: { name }
            // Name must be 1-128 chars, must not start with space + - @ = and
            // must not end with a space.
            const path = this.buildPath(
                `/sites/${encodeURIComponent(resolvedSiteId)}/clients/${encodeURIComponent(clientMac)}/name`
            );
            const response = await this.request.request<OmadaApiResponse<unknown>>({
                method: 'PATCH',
                url: path,
                data: { name },
            });
            results.name = this.request.ensureSuccess(response);
        }

        if (rateLimitEnable !== undefined || upLimit !== undefined || downLimit !== undefined) {
            // PATCH /sites/{siteId}/clients/{clientMac}/ratelimit
            const path = this.buildPath(
                `/sites/${encodeURIComponent(resolvedSiteId)}/clients/${encodeURIComponent(clientMac)}/ratelimit`
            );
            const response = await this.request.request<OmadaApiResponse<unknown>>({
                method: 'PATCH',
                url: path,
                data: { rateLimitEnable, upLimit, downLimit },
            });
            results.rateLimit = this.request.ensureSuccess(response);
        }

        const unsupported = Object.keys(rest);
        if (unsupported.length > 0) {
            // Fail loudly rather than silently dropping the field. fixedIp in
            // particular has no per-client Open API endpoint; use the batch
            // POST /sites/{siteId}/clients/config, or genericApiCall.
            throw new Error(
                `updateClient cannot set ${unsupported.join(', ')} via the Open API. ` +
                    `Only name and rate-limit fields have per-client endpoints. ` +
                    `Use genericApiCall or the batch clients/config endpoint for the rest.`
            );
        }

        if (Object.keys(results).length === 0) {
            throw new Error('updateClient called with nothing to change.');
        }

        return results;
    }

    /**
     * Set device LED setting (v1 API).
     */
    public async setDeviceLed(deviceMac: string, ledSetting: number, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/devices/${encodeURIComponent(deviceMac)}/led-setting`);
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, { ledSetting });
        return this.request.ensureSuccess(response);
    }

    /**
     * Get firmware details for a device (v1 API).
     */
    public async getFirmwareDetails(deviceMac: string, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/devices/${encodeURIComponent(deviceMac)}/firmware`);
        const response = await this.request.get<OmadaApiResponse<unknown>>(path);
        return this.request.ensureSuccess(response);
    }

    /**
     * Start firmware upgrade for a device (v1 API).
     */
    public async startFirmwareUpgrade(deviceMac: string, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/devices/${encodeURIComponent(deviceMac)}/firmware/upgrade`);
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, {});
        return this.request.ensureSuccess(response);
    }

    /**
     * Connect or disconnect a gateway WAN port (v1 API).
     */
    public async setGatewayWanConnect(gatewayMac: string, portId: string, action: 'connect' | 'disconnect', siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(
            `/sites/${encodeURIComponent(resolvedSiteId)}/gateways/${encodeURIComponent(gatewayMac)}/wan/${encodeURIComponent(portId)}/${action}`
        );
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, {});
        return this.request.ensureSuccess(response);
    }
}

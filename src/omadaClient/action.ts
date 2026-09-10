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
    public async adoptDevice(deviceMac: string, siteId?: string, credentials?: { username?: string; password?: string }): Promise<unknown> {
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

    /**
     * Set (or clear) a client's fixed IP reservation.
     *
     * PATCH /network/sites/{siteId}/cmd/clients/{clientMac}/update-ipSetting
     * Note the /network prefix before /sites - unlike every other client
     * endpoint, which sit directly under /sites.
     *
     * useFixedAddr is the only required field. Pass false to release a
     * reservation; pass true with an ip to create one.
     */
    public async setClientIpSetting(
        clientMac: string,
        setting: {
            useFixedAddr: boolean;
            ip?: string;
            netId?: string;
            serverMac?: string;
            serverStackId?: string;
            serverType?: string;
        },
        siteId?: string
    ): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(
            `/network/sites/${encodeURIComponent(resolvedSiteId)}/cmd/clients/${encodeURIComponent(clientMac)}/update-ipSetting`
        );
        const response = await this.request.patch<OmadaApiResponse<unknown>>(path, setting);
        return this.request.ensureSuccess(response);
    }

    public async updateClient(clientMac: string, data: Record<string, unknown>, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const results: Record<string, unknown> = {};

        // The Omada Open API has no single "update client" endpoint. Each
        // attribute has its own, and the path this method used to PATCH
        // (/clients/{mac}) only supports GET and DELETE - so every call
        // returned 405 Method Not Allowed. Verified against the bundled
        // OpenAPI specs in docs/openapi/.
        const { name, rateLimitEnable, upLimit, downLimit, fixedIp, useFixedAddr, ...rest } = data as {
            name?: string;
            rateLimitEnable?: boolean;
            upLimit?: number;
            downLimit?: number;
            fixedIp?: string;
            useFixedAddr?: boolean;
            [k: string]: unknown;
        };

        if (name !== undefined) {
            // PATCH /sites/{siteId}/clients/{clientMac}/name  body: { name }
            // Name must be 1-128 chars, must not start with space + - @ = and
            // must not end with a space.
            const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/clients/${encodeURIComponent(clientMac)}/name`);
            const response = await this.request.request<OmadaApiResponse<unknown>>({
                method: 'PATCH',
                url: path,
                data: { name },
            });
            results.name = this.request.ensureSuccess(response);
        }

        if (rateLimitEnable !== undefined || upLimit !== undefined || downLimit !== undefined) {
            // PATCH /sites/{siteId}/clients/{clientMac}/ratelimit
            const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/clients/${encodeURIComponent(clientMac)}/ratelimit`);
            const response = await this.request.request<OmadaApiResponse<unknown>>({
                method: 'PATCH',
                url: path,
                data: { rateLimitEnable, upLimit, downLimit },
            });
            results.rateLimit = this.request.ensureSuccess(response);
        }

        if (fixedIp !== undefined || useFixedAddr !== undefined) {
            // Static DHCP reservation. fixedIp implies useFixedAddr: true;
            // pass useFixedAddr: false explicitly to release one.
            results.ipSetting = await this.setClientIpSetting(
                clientMac,
                {
                    useFixedAddr: useFixedAddr ?? fixedIp !== undefined,
                    ...(fixedIp !== undefined ? { ip: fixedIp } : {}),
                },
                siteId
            );
        }

        const unsupported = Object.keys(rest);
        if (unsupported.length > 0) {
            // Fail loudly rather than silently dropping the field.
            throw new Error(
                `updateClient cannot set ${unsupported.join(', ')} via the Open API. ` +
                    `Only name, rate-limit and fixed-IP fields have per-client endpoints. ` +
                    `Use genericApiCall or the batch clients/config endpoint for the rest.`
            );
        }

        if (Object.keys(results).length === 0) {
            throw new Error('updateClient called with nothing to change.');
        }

        return results;
    }

    /**
     * Enable or disable the status LEDs for a SITE.
     *
     * The Open API has no per-device LED endpoint - only PUT /sites/{siteId}/led,
     * which applies to every device on the site. This method used to POST to
     * /devices/{mac}/led-setting, a path that does not exist.
     *
     * For a single device, POST /sites/{siteId}/devices/{mac}/locate makes that
     * device flash its LED to identify it, which is usually what is actually
     * wanted - exposed separately if/when a locateDevice tool is added.
     */
    public async setSiteLed(enable: boolean, siteId?: string): Promise<unknown> {
        const resolvedSiteId = this.site.resolveSiteId(siteId);
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/led`);
        const response = await this.request.put<OmadaApiResponse<unknown>>(path, { enable });
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
        const path = this.buildPath(`/sites/${encodeURIComponent(resolvedSiteId)}/devices/${encodeURIComponent(deviceMac)}/start-online-upgrade`);
        const response = await this.request.post<OmadaApiResponse<unknown>>(path, {});
        return this.request.ensureSuccess(response);
    }
}

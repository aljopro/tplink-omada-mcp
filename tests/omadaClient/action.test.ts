import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionOperations } from '../../src/omadaClient/action.js';
import type { RequestHandler } from '../../src/omadaClient/request.js';
import type { SiteOperations } from '../../src/omadaClient/site.js';

describe('omadaClient/action', () => {
    let mockRequest: RequestHandler;
    let mockSite: SiteOperations;
    let actionOps: ActionOperations;

    beforeEach(() => {
        mockRequest = {
            request: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            get: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            post: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            put: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            patch: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            ensureSuccess: vi.fn((response: { result: unknown }) => response.result),
        } as unknown as RequestHandler;

        mockSite = {
            resolveSiteId: vi.fn((siteId?: string) => siteId ?? 'default-site'),
        } as unknown as SiteOperations;

        actionOps = new ActionOperations(mockRequest, mockSite, (path: string) => `/api${path}`);
    });

    describe('device actions', () => {
        it('rebootDevice should POST to the reboot path', async () => {
            const result = await actionOps.rebootDevice('AA-BB-CC-DD-EE-FF');

            expect(mockRequest.post).toHaveBeenCalledWith('/api/sites/default-site/devices/AA-BB-CC-DD-EE-FF/reboot', {});
            expect(result).toBe('ok');
        });

        it('startFirmwareUpgrade should POST to start-online-upgrade', async () => {
            await actionOps.startFirmwareUpgrade('AA-BB-CC-DD-EE-FF', 'site-1');

            expect(mockRequest.post).toHaveBeenCalledWith('/api/sites/site-1/devices/AA-BB-CC-DD-EE-FF/start-online-upgrade', {});
        });

        it('getFirmwareDetails should GET the firmware path', async () => {
            await actionOps.getFirmwareDetails('AA-BB-CC-DD-EE-FF');

            expect(mockRequest.get).toHaveBeenCalledWith('/api/sites/default-site/devices/AA-BB-CC-DD-EE-FF/firmware');
        });

        // Device credentials are what unsticks a device held by a previous
        // controller (the "Managed by Others" state). An empty body is the
        // normal case; credentials must be forwarded verbatim when supplied.
        it('adoptDevice should POST an empty body when no credentials are given', async () => {
            await actionOps.adoptDevice('AA-BB-CC-DD-EE-FF');

            expect(mockRequest.post).toHaveBeenCalledWith('/api/sites/default-site/devices/AA-BB-CC-DD-EE-FF/start-adopt', {});
        });

        it('adoptDevice should forward device credentials when given', async () => {
            await actionOps.adoptDevice('AA-BB-CC-DD-EE-FF', 'site-1', { username: 'admin', password: 'secret' });

            expect(mockRequest.post).toHaveBeenCalledWith('/api/sites/site-1/devices/AA-BB-CC-DD-EE-FF/start-adopt', {
                username: 'admin',
                password: 'secret',
            });
        });
    });

    describe('client actions', () => {
        it.each([
            ['blockClient', 'block'],
            ['unblockClient', 'unblock'],
            ['reconnectClient', 'reconnect'],
        ] as const)('%s should POST to the %s path', async (method, segment) => {
            await actionOps[method]('AA-BB-CC-DD-EE-FF');

            expect(mockRequest.post).toHaveBeenCalledWith(`/api/sites/default-site/clients/AA-BB-CC-DD-EE-FF/${segment}`, {});
        });
    });

    describe('setSiteLed', () => {
        // Site-scoped by necessity: the Open API has no per-device LED endpoint.
        it('should PUT the enable flag to the site led path', async () => {
            await actionOps.setSiteLed(true, 'site-1');

            expect(mockRequest.put).toHaveBeenCalledWith('/api/sites/site-1/led', { enable: true });
        });

        it('should pass enable: false through', async () => {
            await actionOps.setSiteLed(false);

            expect(mockRequest.put).toHaveBeenCalledWith('/api/sites/default-site/led', { enable: false });
        });
    });

    describe('setClientIpSetting', () => {
        // Note the /network prefix before /sites - unlike every other client
        // endpoint. Getting this wrong is what made the original 405.
        it('should PATCH the /network-prefixed update-ipSetting path', async () => {
            await actionOps.setClientIpSetting('AA-BB-CC-DD-EE-FF', { useFixedAddr: true, ip: '192.168.1.50' }, 'site-1');

            expect(mockRequest.patch).toHaveBeenCalledWith('/api/network/sites/site-1/cmd/clients/AA-BB-CC-DD-EE-FF/update-ipSetting', {
                useFixedAddr: true,
                ip: '192.168.1.50',
            });
        });

        it('should release a reservation with useFixedAddr: false', async () => {
            await actionOps.setClientIpSetting('AA-BB-CC-DD-EE-FF', { useFixedAddr: false });

            expect(mockRequest.patch).toHaveBeenCalledWith('/api/network/sites/default-site/cmd/clients/AA-BB-CC-DD-EE-FF/update-ipSetting', {
                useFixedAddr: false,
            });
        });
    });

    describe('updateClient', () => {
        // There is no single "update client" endpoint. Each attribute has its
        // own, so this method fans out and collects the results.
        it('should PATCH the name endpoint for a rename', async () => {
            const result = await actionOps.updateClient('AA-BB-CC-DD-EE-FF', { name: 'Office iMac' });

            expect(mockRequest.request).toHaveBeenCalledWith({
                method: 'PATCH',
                url: '/api/sites/default-site/clients/AA-BB-CC-DD-EE-FF/name',
                data: { name: 'Office iMac' },
            });
            expect(result).toEqual({ name: 'ok' });
        });

        it('should PATCH the ratelimit endpoint for rate-limit fields', async () => {
            const result = await actionOps.updateClient('AA-BB-CC-DD-EE-FF', {
                rateLimitEnable: true,
                upLimit: 1024,
                downLimit: 4096,
            });

            expect(mockRequest.request).toHaveBeenCalledWith({
                method: 'PATCH',
                url: '/api/sites/default-site/clients/AA-BB-CC-DD-EE-FF/ratelimit',
                data: { rateLimitEnable: true, upLimit: 1024, downLimit: 4096 },
            });
            expect(result).toEqual({ rateLimit: 'ok' });
        });

        it('should treat a fixedIp as implying useFixedAddr: true', async () => {
            const result = await actionOps.updateClient('AA-BB-CC-DD-EE-FF', { fixedIp: '192.168.1.50' });

            expect(mockRequest.patch).toHaveBeenCalledWith('/api/network/sites/default-site/cmd/clients/AA-BB-CC-DD-EE-FF/update-ipSetting', {
                useFixedAddr: true,
                ip: '192.168.1.50',
            });
            expect(result).toEqual({ ipSetting: 'ok' });
        });

        it('should release a reservation when useFixedAddr is false and send no ip', async () => {
            await actionOps.updateClient('AA-BB-CC-DD-EE-FF', { useFixedAddr: false });

            expect(mockRequest.patch).toHaveBeenCalledWith('/api/network/sites/default-site/cmd/clients/AA-BB-CC-DD-EE-FF/update-ipSetting', {
                useFixedAddr: false,
            });
        });

        it('should let an explicit useFixedAddr win over the fixedIp default', async () => {
            await actionOps.updateClient('AA-BB-CC-DD-EE-FF', { fixedIp: '192.168.1.50', useFixedAddr: false });

            expect(mockRequest.patch).toHaveBeenCalledWith('/api/network/sites/default-site/cmd/clients/AA-BB-CC-DD-EE-FF/update-ipSetting', {
                useFixedAddr: false,
                ip: '192.168.1.50',
            });
        });

        it('should fan out to every endpoint when several attributes change at once', async () => {
            const result = await actionOps.updateClient('AA-BB-CC-DD-EE-FF', {
                name: 'Office iMac',
                rateLimitEnable: true,
                fixedIp: '192.168.1.50',
            });

            expect(result).toEqual({ name: 'ok', rateLimit: 'ok', ipSetting: 'ok' });
            expect(mockRequest.request).toHaveBeenCalledTimes(2);
            expect(mockRequest.patch).toHaveBeenCalledTimes(1);
        });

        it('should forward siteId to every sub-request', async () => {
            await actionOps.updateClient('AA-BB-CC-DD-EE-FF', { name: 'X', fixedIp: '192.168.1.50' }, 'site-1');

            expect(mockRequest.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/sites/site-1/clients/AA-BB-CC-DD-EE-FF/name' }));
            expect(mockRequest.patch).toHaveBeenCalledWith(
                '/api/network/sites/site-1/cmd/clients/AA-BB-CC-DD-EE-FF/update-ipSetting',
                expect.anything()
            );
        });

        // Failing loudly beats silently dropping a field the caller asked for.
        it('should throw naming the unsupported fields rather than dropping them', async () => {
            await expect(actionOps.updateClient('AA-BB-CC-DD-EE-FF', { name: 'X', deviceType: 'laptop', vendor: 'Apple' })).rejects.toThrow(
                /cannot set deviceType, vendor via the Open API/
            );
        });

        it('should throw when called with nothing to change', async () => {
            await expect(actionOps.updateClient('AA-BB-CC-DD-EE-FF', {})).rejects.toThrow('updateClient called with nothing to change.');
        });

        it('should not call any endpoint when there is nothing to change', async () => {
            await expect(actionOps.updateClient('AA-BB-CC-DD-EE-FF', {})).rejects.toThrow();

            expect(mockRequest.request).not.toHaveBeenCalled();
            expect(mockRequest.patch).not.toHaveBeenCalled();
        });
    });

    describe('path encoding', () => {
        it('should percent-encode site and client identifiers', async () => {
            await actionOps.blockClient('AA:BB/CC', 'site one');

            expect(mockRequest.post).toHaveBeenCalledWith('/api/sites/site%20one/clients/AA%3ABB%2FCC/block', {});
        });
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestHandler } from '../../src/omadaClient/request.js';
import { SwitchOperations } from '../../src/omadaClient/switch.js';

describe('omadaClient/switch', () => {
    let mockRequest: RequestHandler;
    let switchOps: SwitchOperations;

    const MAC = 'AA-BB-CC-DD-EE-FF';
    const base = `/api/sites/default-site/switches/${MAC}`;

    beforeEach(() => {
        mockRequest = {
            request: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            get: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            post: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            put: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            patch: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
            ensureSuccess: vi.fn((response: { result: unknown }) => response.result),
        } as unknown as RequestHandler;

        switchOps = new SwitchOperations(
            mockRequest,
            { resolveSiteId: vi.fn((siteId?: string) => siteId ?? 'default-site') } as never,
            (path: string) => `/api${path}`
        );
    });

    describe('reads', () => {
        it('getSwitch should GET the switch path', async () => {
            const result = await switchOps.getSwitch(MAC);

            expect(mockRequest.get).toHaveBeenCalledWith(base);
            expect(result).toBe('ok');
        });

        it('getSwitchNetworks should GET the networks path', async () => {
            await switchOps.getSwitchNetworks(MAC);

            expect(mockRequest.get).toHaveBeenCalledWith(`${base}/networks`);
        });

        it('getCableTestResults should GET the full-results path', async () => {
            await switchOps.getCableTestResults(MAC);

            expect(mockRequest.get).toHaveBeenCalledWith(`/api/sites/default-site/cable-test/switches/${MAC}/full-results`);
        });
    });

    // Single-port writes. Each is PUT to .../ports/{port}/{attribute} with a
    // one-key body - the port number lives in the path, not the payload.
    describe('single-port writes', () => {
        it('setSwitchPortProfile should PUT profileId to the profile path', async () => {
            const result = await switchOps.setSwitchPortProfile(MAC, 3, 'p-1');

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/ports/3/profile`, { profileId: 'p-1' });
            expect(result).toBe('ok');
        });

        it('setSwitchPortPoe should PUT poeMode to the poe-mode path', async () => {
            await switchOps.setSwitchPortPoe(MAC, 3, 1);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/ports/3/poe-mode`, { poeMode: 1 });
        });

        it('setSwitchPortName should PUT name to the name path', async () => {
            await switchOps.setSwitchPortName(MAC, 3, 'Office Uplink');

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/ports/3/name`, { name: 'Office Uplink' });
        });

        it('setSwitchPortStatus should PUT status to the status path', async () => {
            await switchOps.setSwitchPortStatus(MAC, 3, 0);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/ports/3/status`, { status: 0 });
        });

        it('setSwitchPortProfileOverride should PUT the flag to the profile-override path', async () => {
            await switchOps.setSwitchPortProfileOverride(MAC, 3, true);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/ports/3/profile-override`, { profileOverrideEnable: true });
        });

        it('should pass poeMode 0 through rather than treating it as absent', async () => {
            await switchOps.setSwitchPortPoe(MAC, 1, 0);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/ports/1/poe-mode`, { poeMode: 0 });
        });
    });

    // Batch writes go to .../multi-ports/{attribute} and carry the port list
    // in the body instead of the path.
    describe('batch writes', () => {
        it('batchSetSwitchPortPoe should PUT portList and poeMode', async () => {
            await switchOps.batchSetSwitchPortPoe(MAC, [1, 2, 3], 1);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/multi-ports/poe-mode`, { portList: [1, 2, 3], poeMode: 1 });
        });

        it('batchSetSwitchPortStatus should PUT portList and status', async () => {
            await switchOps.batchSetSwitchPortStatus(MAC, [1, 2], 0);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/multi-ports/status`, { portList: [1, 2], status: 0 });
        });

        it('batchSetSwitchPortProfile should PUT portList and the override flag', async () => {
            await switchOps.batchSetSwitchPortProfile(MAC, [1, 2], false);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/multi-ports/profile-override`, {
                portList: [1, 2],
                profileOverrideEnable: false,
            });
        });

        it('batchSetSwitchPortName should PUT the port/name pair list', async () => {
            const portNameList = [
                { port: 1, name: 'Office AP' },
                { port: 2, name: 'Living Room AP' },
            ];

            await switchOps.batchSetSwitchPortName(MAC, portNameList);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/multi-ports/name`, { portNameList });
        });

        it('should forward an empty port list unchanged rather than substituting all ports', async () => {
            await switchOps.batchSetSwitchPortStatus(MAC, [], 1);

            expect(mockRequest.put).toHaveBeenCalledWith(`${base}/multi-ports/status`, { portList: [], status: 1 });
        });
    });

    describe('cable test and networks', () => {
        it('startCableTest should POST to the cable-test start path', async () => {
            await switchOps.startCableTest(MAC);

            expect(mockRequest.post).toHaveBeenCalledWith(`/api/sites/default-site/cable-test/switches/${MAC}/start`, {});
        });

        it('setSwitchNetworks should POST the payload verbatim', async () => {
            await switchOps.setSwitchNetworks(MAC, { profileId: 'p-1', vlan: 20 });

            expect(mockRequest.post).toHaveBeenCalledWith(`${base}/networks`, { profileId: 'p-1', vlan: 20 });
        });
    });

    describe('siteId handling', () => {
        it('should use the explicit siteId when given', async () => {
            await switchOps.setSwitchPortName(MAC, 1, 'X', 'site-1');

            expect(mockRequest.put).toHaveBeenCalledWith(`/api/sites/site-1/switches/${MAC}/ports/1/name`, { name: 'X' });
        });

        it('should percent-encode site and switch identifiers', async () => {
            await switchOps.getSwitch('AA:BB/CC', 'site one');

            expect(mockRequest.get).toHaveBeenCalledWith('/api/sites/site%20one/switches/AA%3ABB%2FCC');
        });
    });
});

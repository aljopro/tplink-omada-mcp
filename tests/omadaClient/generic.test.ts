import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenericOperations } from '../../src/omadaClient/generic.js';
import type { RequestHandler } from '../../src/omadaClient/request.js';

describe('omadaClient/generic', () => {
    let mockRequest: RequestHandler;
    let buildPath: ReturnType<typeof vi.fn>;
    let genericOps: GenericOperations;

    beforeEach(() => {
        mockRequest = {
            request: vi.fn().mockResolvedValue({ errorCode: 0, result: 'ok' }),
        } as unknown as RequestHandler;

        buildPath = vi.fn((path: string, version?: string) => `/openapi/${version ?? 'v1'}/omadac${path}`);

        genericOps = new GenericOperations(mockRequest, buildPath as never);
    });

    describe('genericApiCall', () => {
        // The escape hatch: whatever the caller passes is forwarded as-is.
        // Its value depends on not second-guessing the arguments.
        it('should forward method, path, body and query params', async () => {
            const result = await genericOps.genericApiCall('POST', '/sites/s-1/clients', 'v1', { name: 'X' }, { page: 1 });

            expect(mockRequest.request).toHaveBeenCalledWith({
                method: 'POST',
                url: '/openapi/v1/omadac/sites/s-1/clients',
                data: { name: 'X' },
                params: { page: 1 },
            });
            expect(result).toEqual({ errorCode: 0, result: 'ok' });
        });

        it('should default to v1 when no version is given', async () => {
            await genericOps.genericApiCall('GET', '/sites');

            expect(buildPath).toHaveBeenCalledWith('/sites', 'v1');
        });

        it('should pass a non-default version through to buildPath', async () => {
            await genericOps.genericApiCall('GET', '/sites', 'v2');

            expect(buildPath).toHaveBeenCalledWith('/sites', 'v2');
            expect(mockRequest.request).toHaveBeenCalledWith(expect.objectContaining({ url: '/openapi/v2/omadac/sites' }));
        });

        it('should send undefined body and params when omitted', async () => {
            await genericOps.genericApiCall('GET', '/sites');

            expect(mockRequest.request).toHaveBeenCalledWith({
                method: 'GET',
                url: '/openapi/v1/omadac/sites',
                data: undefined,
                params: undefined,
            });
        });

        // Unlike the typed operations, this returns the envelope untouched -
        // callers of an arbitrary endpoint need the errorCode too.
        it('should return the raw response without unwrapping the envelope', async () => {
            (mockRequest.request as ReturnType<typeof vi.fn>).mockResolvedValue({ errorCode: -1007, msg: 'Insufficient permission' });

            const result = await genericOps.genericApiCall('PATCH', '/sites/s-1/clients/AA/name');

            expect(result).toEqual({ errorCode: -1007, msg: 'Insufficient permission' });
        });

        it('should propagate transport errors', async () => {
            (mockRequest.request as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ECONNREFUSED'));

            await expect(genericOps.genericApiCall('GET', '/sites')).rejects.toThrow('ECONNREFUSED');
        });
    });
});

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerCreateLanNetworkTool } from '../../src/tools/createLanNetwork.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/createLanNetwork', () => {
    let mockServer: McpServer;
    let mockClient: OmadaClient;
    let toolHandler: (args: unknown, extra: { sessionId?: string }) => Promise<unknown>;

    beforeEach(() => {
        mockServer = {
            registerTool: vi.fn((_name, _schema, handler) => {
                toolHandler = handler;
            }),
        } as unknown as McpServer;

        mockClient = {
            createLanNetwork: vi.fn(),
        } as unknown as OmadaClient;

        vi.spyOn(loggerModule.logger, 'info').mockImplementation(() => {
            // Mock implementation
        });
        vi.spyOn(loggerModule.logger, 'error').mockImplementation(() => {
            // Mock implementation
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('registerCreateLanNetworkTool', () => {
        it('should register the createLanNetwork tool with correct schema', () => {
            registerCreateLanNetworkTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('createLanNetwork', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.createLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerCreateLanNetworkTool(mockServer, mockClient);

            const result = await toolHandler({ name: 'Guest VLAN', vlan: 20 }, { sessionId: 'test-session' });

            expect(mockClient.createLanNetwork).toHaveBeenCalledWith({ name: 'Guest VLAN', vlan: 20 }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.createLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerCreateLanNetworkTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', name: 'Guest VLAN', vlan: 20 }, { sessionId: 'test-session' });

            expect(mockClient.createLanNetwork).toHaveBeenCalledWith({ name: 'Guest VLAN', vlan: 20 }, 'test-site');
        });

        // ({ siteId, ...data }) - siteId must be consumed as the site argument,
        // never forwarded inside the request payload.
        it('should not leak siteId into the request payload', async () => {
            (mockClient.createLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerCreateLanNetworkTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', name: 'Guest VLAN', vlan: 20 }, { sessionId: 'test-session' });

            const payload = (mockClient.createLanNetwork as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(payload).toEqual({ name: 'Guest VLAN', vlan: 20 });
            expect(payload).not.toHaveProperty('siteId');
        });

        it('should handle empty response', async () => {
            (mockClient.createLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerCreateLanNetworkTool(mockServer, mockClient);

            const result = await toolHandler({ name: 'Guest VLAN', vlan: 20 }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.createLanNetwork as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerCreateLanNetworkTool(mockServer, mockClient);

            await expect(toolHandler({ name: 'Guest VLAN', vlan: 20 }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'createLanNetwork',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

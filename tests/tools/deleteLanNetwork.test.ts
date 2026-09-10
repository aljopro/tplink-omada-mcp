import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteLanNetworkTool } from '../../src/tools/deleteLanNetwork.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteLanNetwork', () => {
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
            deleteLanNetwork: vi.fn(),
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

    describe('registerDeleteLanNetworkTool', () => {
        it('should register the deleteLanNetwork tool with correct schema', () => {
            registerDeleteLanNetworkTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteLanNetwork', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteLanNetworkTool(mockServer, mockClient);

            const result = await toolHandler({ networkId: 'net-1' }, { sessionId: 'test-session' });

            expect(mockClient.deleteLanNetwork).toHaveBeenCalledWith('net-1', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerDeleteLanNetworkTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', networkId: 'net-1' }, { sessionId: 'test-session' });

            expect(mockClient.deleteLanNetwork).toHaveBeenCalledWith('net-1', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerDeleteLanNetworkTool(mockServer, mockClient);

            const result = await toolHandler({ networkId: 'net-1' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.deleteLanNetwork as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerDeleteLanNetworkTool(mockServer, mockClient);

            await expect(toolHandler({ networkId: 'net-1' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'deleteLanNetwork',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

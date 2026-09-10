import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerSetSwitchNetworksTool } from '../../src/tools/setSwitchNetworks.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/setSwitchNetworks', () => {
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
            setSwitchNetworks: vi.fn(),
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

    describe('registerSetSwitchNetworksTool', () => {
        it('should register the setSwitchNetworks tool with correct schema', () => {
            registerSetSwitchNetworksTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('setSwitchNetworks', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.setSwitchNetworks as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerSetSwitchNetworksTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', data: { profileId: 'p-1' } }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchNetworks).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', { profileId: 'p-1' }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.setSwitchNetworks as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerSetSwitchNetworksTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', data: { profileId: 'p-1' } }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchNetworks).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', { profileId: 'p-1' }, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.setSwitchNetworks as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerSetSwitchNetworksTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', data: { profileId: 'p-1' } }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.setSwitchNetworks as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerSetSwitchNetworksTool(mockServer, mockClient);

            await expect(toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', data: { profileId: 'p-1' } }, { sessionId: 'test-session' })).rejects.toThrow(
                'API error'
            );

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'setSwitchNetworks',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

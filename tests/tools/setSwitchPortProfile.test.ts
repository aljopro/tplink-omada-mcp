import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerSetSwitchPortProfileTool } from '../../src/tools/setSwitchPortProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/setSwitchPortProfile', () => {
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
            setSwitchPortProfile: vi.fn(),
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

    describe('registerSetSwitchPortProfileTool', () => {
        it('should register the setSwitchPortProfile tool with correct schema', () => {
            registerSetSwitchPortProfileTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('setSwitchPortProfile', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.setSwitchPortProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerSetSwitchPortProfileTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileId: 'p-1' }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchPortProfile).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, 'p-1', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.setSwitchPortProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerSetSwitchPortProfileTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileId: 'p-1' }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchPortProfile).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, 'p-1', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.setSwitchPortProfile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerSetSwitchPortProfileTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileId: 'p-1' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.setSwitchPortProfile as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerSetSwitchPortProfileTool(mockServer, mockClient);

            await expect(toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileId: 'p-1' }, { sessionId: 'test-session' })).rejects.toThrow(
                'API error'
            );

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'setSwitchPortProfile',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

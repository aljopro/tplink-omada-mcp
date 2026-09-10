import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerSetSwitchPortProfileOverrideTool } from '../../src/tools/setSwitchPortProfileOverride.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/setSwitchPortProfileOverride', () => {
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
            setSwitchPortProfileOverride: vi.fn(),
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

    describe('registerSetSwitchPortProfileOverrideTool', () => {
        it('should register the setSwitchPortProfileOverride tool with correct schema', () => {
            registerSetSwitchPortProfileOverrideTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('setSwitchPortProfileOverride', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.setSwitchPortProfileOverride as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerSetSwitchPortProfileOverrideTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileOverrideEnable: true }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchPortProfileOverride).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, true, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.setSwitchPortProfileOverride as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerSetSwitchPortProfileOverrideTool(mockServer, mockClient);
            await toolHandler(
                { siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileOverrideEnable: true },
                { sessionId: 'test-session' }
            );

            expect(mockClient.setSwitchPortProfileOverride).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, true, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.setSwitchPortProfileOverride as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerSetSwitchPortProfileOverrideTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileOverrideEnable: true }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.setSwitchPortProfileOverride as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerSetSwitchPortProfileOverrideTool(mockServer, mockClient);

            await expect(
                toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, profileOverrideEnable: true }, { sessionId: 'test-session' })
            ).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'setSwitchPortProfileOverride',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerBatchSetSwitchPortProfileTool } from '../../src/tools/batchSetSwitchPortProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/batchSetSwitchPortProfile', () => {
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
            batchSetSwitchPortProfile: vi.fn(),
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

    describe('registerBatchSetSwitchPortProfileTool', () => {
        it('should register the batchSetSwitchPortProfile tool with correct schema', () => {
            registerBatchSetSwitchPortProfileTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('batchSetSwitchPortProfile', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.batchSetSwitchPortProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerBatchSetSwitchPortProfileTool(mockServer, mockClient);

            const result = await toolHandler(
                { switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], profileOverrideEnable: true },
                { sessionId: 'test-session' }
            );

            expect(mockClient.batchSetSwitchPortProfile).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [1, 2], true, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.batchSetSwitchPortProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerBatchSetSwitchPortProfileTool(mockServer, mockClient);
            await toolHandler(
                { siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], profileOverrideEnable: true },
                { sessionId: 'test-session' }
            );

            expect(mockClient.batchSetSwitchPortProfile).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [1, 2], true, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.batchSetSwitchPortProfile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerBatchSetSwitchPortProfileTool(mockServer, mockClient);

            const result = await toolHandler(
                { switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], profileOverrideEnable: true },
                { sessionId: 'test-session' }
            );

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.batchSetSwitchPortProfile as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerBatchSetSwitchPortProfileTool(mockServer, mockClient);

            await expect(
                toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], profileOverrideEnable: true }, { sessionId: 'test-session' })
            ).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'batchSetSwitchPortProfile',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

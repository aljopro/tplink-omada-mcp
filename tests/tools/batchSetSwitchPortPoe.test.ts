import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerBatchSetSwitchPortPoeTool } from '../../src/tools/batchSetSwitchPortPoe.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/batchSetSwitchPortPoe', () => {
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
            batchSetSwitchPortPoe: vi.fn(),
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

    describe('registerBatchSetSwitchPortPoeTool', () => {
        it('should register the batchSetSwitchPortPoe tool with correct schema', () => {
            registerBatchSetSwitchPortPoeTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('batchSetSwitchPortPoe', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.batchSetSwitchPortPoe as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerBatchSetSwitchPortPoeTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], poeMode: 1 }, { sessionId: 'test-session' });

            expect(mockClient.batchSetSwitchPortPoe).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [1, 2], 1, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.batchSetSwitchPortPoe as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerBatchSetSwitchPortPoeTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], poeMode: 1 }, { sessionId: 'test-session' });

            expect(mockClient.batchSetSwitchPortPoe).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [1, 2], 1, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.batchSetSwitchPortPoe as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerBatchSetSwitchPortPoeTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], poeMode: 1 }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.batchSetSwitchPortPoe as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerBatchSetSwitchPortPoeTool(mockServer, mockClient);

            await expect(
                toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], poeMode: 1 }, { sessionId: 'test-session' })
            ).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'batchSetSwitchPortPoe',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerBatchSetSwitchPortStatusTool } from '../../src/tools/batchSetSwitchPortStatus.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/batchSetSwitchPortStatus', () => {
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
            batchSetSwitchPortStatus: vi.fn(),
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

    describe('registerBatchSetSwitchPortStatusTool', () => {
        it('should register the batchSetSwitchPortStatus tool with correct schema', () => {
            registerBatchSetSwitchPortStatusTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('batchSetSwitchPortStatus', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.batchSetSwitchPortStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerBatchSetSwitchPortStatusTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], status: 0 }, { sessionId: 'test-session' });

            expect(mockClient.batchSetSwitchPortStatus).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [1, 2], 0, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.batchSetSwitchPortStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerBatchSetSwitchPortStatusTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], status: 0 }, { sessionId: 'test-session' });

            expect(mockClient.batchSetSwitchPortStatus).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [1, 2], 0, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.batchSetSwitchPortStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerBatchSetSwitchPortStatusTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], status: 0 }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.batchSetSwitchPortStatus as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerBatchSetSwitchPortStatusTool(mockServer, mockClient);

            await expect(toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portList: [1, 2], status: 0 }, { sessionId: 'test-session' })).rejects.toThrow(
                'API error'
            );

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'batchSetSwitchPortStatus',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

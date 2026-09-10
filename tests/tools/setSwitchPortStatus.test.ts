import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerSetSwitchPortStatusTool } from '../../src/tools/setSwitchPortStatus.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/setSwitchPortStatus', () => {
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
            setSwitchPortStatus: vi.fn(),
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

    describe('registerSetSwitchPortStatusTool', () => {
        it('should register the setSwitchPortStatus tool with correct schema', () => {
            registerSetSwitchPortStatusTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('setSwitchPortStatus', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.setSwitchPortStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerSetSwitchPortStatusTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, status: 1 }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchPortStatus).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, 1, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.setSwitchPortStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerSetSwitchPortStatusTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, status: 1 }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchPortStatus).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, 1, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.setSwitchPortStatus as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerSetSwitchPortStatusTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, status: 1 }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.setSwitchPortStatus as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerSetSwitchPortStatusTool(mockServer, mockClient);

            await expect(toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, status: 1 }, { sessionId: 'test-session' })).rejects.toThrow(
                'API error'
            );

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'setSwitchPortStatus',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerBatchSetSwitchPortNameTool } from '../../src/tools/batchSetSwitchPortName.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/batchSetSwitchPortName', () => {
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
            batchSetSwitchPortName: vi.fn(),
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

    describe('registerBatchSetSwitchPortNameTool', () => {
        it('should register the batchSetSwitchPortName tool with correct schema', () => {
            registerBatchSetSwitchPortNameTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('batchSetSwitchPortName', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.batchSetSwitchPortName as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerBatchSetSwitchPortNameTool(mockServer, mockClient);

            const result = await toolHandler(
                { switchMac: 'AA-BB-CC-DD-EE-FF', portNameList: [{ port: 1, name: 'AP' }] },
                { sessionId: 'test-session' }
            );

            expect(mockClient.batchSetSwitchPortName).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [{ port: 1, name: 'AP' }], undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.batchSetSwitchPortName as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerBatchSetSwitchPortNameTool(mockServer, mockClient);
            await toolHandler(
                { siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', portNameList: [{ port: 1, name: 'AP' }] },
                { sessionId: 'test-session' }
            );

            expect(mockClient.batchSetSwitchPortName).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', [{ port: 1, name: 'AP' }], 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.batchSetSwitchPortName as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerBatchSetSwitchPortNameTool(mockServer, mockClient);

            const result = await toolHandler(
                { switchMac: 'AA-BB-CC-DD-EE-FF', portNameList: [{ port: 1, name: 'AP' }] },
                { sessionId: 'test-session' }
            );

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.batchSetSwitchPortName as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerBatchSetSwitchPortNameTool(mockServer, mockClient);

            await expect(
                toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portNameList: [{ port: 1, name: 'AP' }] }, { sessionId: 'test-session' })
            ).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'batchSetSwitchPortName',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

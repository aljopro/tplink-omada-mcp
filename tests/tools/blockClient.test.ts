import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerBlockClientTool } from '../../src/tools/blockClient.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/blockClient', () => {
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
            blockClient: vi.fn(),
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

    describe('registerBlockClientTool', () => {
        it('should register the blockClient tool with correct schema', () => {
            registerBlockClientTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('blockClient', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.blockClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerBlockClientTool(mockServer, mockClient);

            const result = await toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.blockClient).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.blockClient as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerBlockClientTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.blockClient).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.blockClient as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerBlockClientTool(mockServer, mockClient);

            const result = await toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.blockClient as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerBlockClientTool(mockServer, mockClient);

            await expect(toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'blockClient',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

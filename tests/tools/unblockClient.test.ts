import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUnblockClientTool } from '../../src/tools/unblockClient.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/unblockClient', () => {
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
            unblockClient: vi.fn(),
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

    describe('registerUnblockClientTool', () => {
        it('should register the unblockClient tool with correct schema', () => {
            registerUnblockClientTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('unblockClient', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.unblockClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUnblockClientTool(mockServer, mockClient);

            const result = await toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.unblockClient).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.unblockClient as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUnblockClientTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.unblockClient).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.unblockClient as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerUnblockClientTool(mockServer, mockClient);

            const result = await toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.unblockClient as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerUnblockClientTool(mockServer, mockClient);

            await expect(toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'unblockClient',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

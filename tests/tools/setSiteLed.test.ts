import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerSetSiteLedTool } from '../../src/tools/setSiteLed.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/setSiteLed', () => {
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
            setSiteLed: vi.fn(),
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

    describe('registerSetSiteLedTool', () => {
        it('should register the setSiteLed tool with correct schema', () => {
            registerSetSiteLedTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('setSiteLed', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.setSiteLed as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerSetSiteLedTool(mockServer, mockClient);

            const result = await toolHandler({ enable: true }, { sessionId: 'test-session' });

            expect(mockClient.setSiteLed).toHaveBeenCalledWith(true, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.setSiteLed as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerSetSiteLedTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', enable: true }, { sessionId: 'test-session' });

            expect(mockClient.setSiteLed).toHaveBeenCalledWith(true, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.setSiteLed as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerSetSiteLedTool(mockServer, mockClient);

            const result = await toolHandler({ enable: true }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.setSiteLed as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerSetSiteLedTool(mockServer, mockClient);

            await expect(toolHandler({ enable: true }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'setSiteLed',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

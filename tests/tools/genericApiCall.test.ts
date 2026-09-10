import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerGenericApiCallTool } from '../../src/tools/genericApiCall.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/genericApiCall', () => {
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
            genericApiCall: vi.fn(),
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

    describe('registerGenericApiCallTool', () => {
        it('should register the genericApiCall tool with correct schema', () => {
            registerGenericApiCallTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('genericApiCall', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.genericApiCall as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerGenericApiCallTool(mockServer, mockClient);

            const result = await toolHandler(
                { method: 'GET', path: '/sites/s-1/clients', version: 'v1', body: undefined, queryParams: { page: 1 } },
                { sessionId: 'test-session' }
            );

            expect(mockClient.genericApiCall).toHaveBeenCalledWith('GET', '/sites/s-1/clients', 'v1', undefined, { page: 1 });
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should handle empty response', async () => {
            (mockClient.genericApiCall as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerGenericApiCallTool(mockServer, mockClient);

            const result = await toolHandler(
                { method: 'GET', path: '/sites/s-1/clients', version: 'v1', body: undefined, queryParams: { page: 1 } },
                { sessionId: 'test-session' }
            );

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.genericApiCall as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerGenericApiCallTool(mockServer, mockClient);

            await expect(
                toolHandler(
                    { method: 'GET', path: '/sites/s-1/clients', version: 'v1', body: undefined, queryParams: { page: 1 } },
                    { sessionId: 'test-session' }
                )
            ).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'genericApiCall',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

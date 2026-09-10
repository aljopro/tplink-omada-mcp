import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerStartCableTestTool } from '../../src/tools/startCableTest.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/startCableTest', () => {
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
            startCableTest: vi.fn(),
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

    describe('registerStartCableTestTool', () => {
        it('should register the startCableTest tool with correct schema', () => {
            registerStartCableTestTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('startCableTest', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.startCableTest as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerStartCableTestTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.startCableTest).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.startCableTest as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerStartCableTestTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.startCableTest).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.startCableTest as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerStartCableTestTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.startCableTest as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerStartCableTestTool(mockServer, mockClient);

            await expect(toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'startCableTest',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

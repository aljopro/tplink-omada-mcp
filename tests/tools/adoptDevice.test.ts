import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerAdoptDeviceTool } from '../../src/tools/adoptDevice.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/adoptDevice', () => {
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
            adoptDevice: vi.fn(),
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

    describe('registerAdoptDeviceTool', () => {
        it('should register the adoptDevice tool with correct schema', () => {
            registerAdoptDeviceTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('adoptDevice', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.adoptDevice as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerAdoptDeviceTool(mockServer, mockClient);

            const result = await toolHandler({ deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.adoptDevice).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.adoptDevice as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerAdoptDeviceTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.adoptDevice).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.adoptDevice as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerAdoptDeviceTool(mockServer, mockClient);

            const result = await toolHandler({ deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.adoptDevice as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerAdoptDeviceTool(mockServer, mockClient);

            await expect(toolHandler({ deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'adoptDevice',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerCreateLanProfileTool } from '../../src/tools/createLanProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/createLanProfile', () => {
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
            createLanProfile: vi.fn(),
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

    describe('registerCreateLanProfileTool', () => {
        it('should register the createLanProfile tool with correct schema', () => {
            registerCreateLanProfileTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('createLanProfile', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.createLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerCreateLanProfileTool(mockServer, mockClient);

            const result = await toolHandler({ name: 'IoT Profile' }, { sessionId: 'test-session' });

            expect(mockClient.createLanProfile).toHaveBeenCalledWith({ name: 'IoT Profile' }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.createLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerCreateLanProfileTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', name: 'IoT Profile' }, { sessionId: 'test-session' });

            expect(mockClient.createLanProfile).toHaveBeenCalledWith({ name: 'IoT Profile' }, 'test-site');
        });

        // ({ siteId, ...data }) - siteId must be consumed as the site argument,
        // never forwarded inside the request payload.
        it('should not leak siteId into the request payload', async () => {
            (mockClient.createLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerCreateLanProfileTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', name: 'IoT Profile' }, { sessionId: 'test-session' });

            const payload = (mockClient.createLanProfile as ReturnType<typeof vi.fn>).mock.calls[0][0];
            expect(payload).toEqual({ name: 'IoT Profile' });
            expect(payload).not.toHaveProperty('siteId');
        });

        it('should handle empty response', async () => {
            (mockClient.createLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerCreateLanProfileTool(mockServer, mockClient);

            const result = await toolHandler({ name: 'IoT Profile' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.createLanProfile as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerCreateLanProfileTool(mockServer, mockClient);

            await expect(toolHandler({ name: 'IoT Profile' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'createLanProfile',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

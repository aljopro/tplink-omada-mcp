import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateClientTool } from '../../src/tools/updateClient.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateClient', () => {
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
            updateClient: vi.fn(),
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

    describe('registerUpdateClientTool', () => {
        it('should register the updateClient tool with correct schema', () => {
            registerUpdateClientTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('updateClient', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.updateClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateClientTool(mockServer, mockClient);

            const result = await toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF', name: 'Office iMac' }, { sessionId: 'test-session' });

            expect(mockClient.updateClient).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', { name: 'Office iMac' }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.updateClient as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUpdateClientTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', clientMac: 'AA-BB-CC-DD-EE-FF', name: 'Office iMac' }, { sessionId: 'test-session' });

            expect(mockClient.updateClient).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', { name: 'Office iMac' }, 'test-site');
        });

        // ({ siteId, ...data }) - siteId must be consumed as the site argument,
        // never forwarded inside the request payload.
        it('should not leak siteId into the request payload', async () => {
            (mockClient.updateClient as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUpdateClientTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', clientMac: 'AA-BB-CC-DD-EE-FF', name: 'Office iMac' }, { sessionId: 'test-session' });

            const payload = (mockClient.updateClient as ReturnType<typeof vi.fn>).mock.calls[0][1];
            expect(payload).toEqual({ name: 'Office iMac' });
            expect(payload).not.toHaveProperty('siteId');
        });

        it('should handle empty response', async () => {
            (mockClient.updateClient as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerUpdateClientTool(mockServer, mockClient);

            const result = await toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF', name: 'Office iMac' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.updateClient as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerUpdateClientTool(mockServer, mockClient);

            await expect(toolHandler({ clientMac: 'AA-BB-CC-DD-EE-FF', name: 'Office iMac' }, { sessionId: 'test-session' })).rejects.toThrow(
                'API error'
            );

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'updateClient',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

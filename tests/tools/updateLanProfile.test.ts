import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateLanProfileTool } from '../../src/tools/updateLanProfile.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateLanProfile', () => {
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
            updateLanProfile: vi.fn(),
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

    describe('registerUpdateLanProfileTool', () => {
        it('should register the updateLanProfile tool with correct schema', () => {
            registerUpdateLanProfileTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('updateLanProfile', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.updateLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateLanProfileTool(mockServer, mockClient);

            const result = await toolHandler({ profileId: 'prof-1', name: 'Renamed' }, { sessionId: 'test-session' });

            expect(mockClient.updateLanProfile).toHaveBeenCalledWith('prof-1', { name: 'Renamed' }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.updateLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUpdateLanProfileTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', profileId: 'prof-1', name: 'Renamed' }, { sessionId: 'test-session' });

            expect(mockClient.updateLanProfile).toHaveBeenCalledWith('prof-1', { name: 'Renamed' }, 'test-site');
        });

        // ({ siteId, ...data }) - siteId must be consumed as the site argument,
        // never forwarded inside the request payload.
        it('should not leak siteId into the request payload', async () => {
            (mockClient.updateLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUpdateLanProfileTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', profileId: 'prof-1', name: 'Renamed' }, { sessionId: 'test-session' });

            const payload = (mockClient.updateLanProfile as ReturnType<typeof vi.fn>).mock.calls[0][1];
            expect(payload).toEqual({ name: 'Renamed' });
            expect(payload).not.toHaveProperty('siteId');
        });

        it('should handle empty response', async () => {
            (mockClient.updateLanProfile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerUpdateLanProfileTool(mockServer, mockClient);

            const result = await toolHandler({ profileId: 'prof-1', name: 'Renamed' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.updateLanProfile as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerUpdateLanProfileTool(mockServer, mockClient);

            await expect(toolHandler({ profileId: 'prof-1', name: 'Renamed' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'updateLanProfile',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

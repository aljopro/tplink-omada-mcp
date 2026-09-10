import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateSwitchPortTool } from '../../src/tools/updateSwitchPort.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateSwitchPort', () => {
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
            updateSwitchPort: vi.fn(),
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

    describe('registerUpdateSwitchPortTool', () => {
        it('should register the updateSwitchPort tool with correct schema', () => {
            registerUpdateSwitchPortTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('updateSwitchPort', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.updateSwitchPort as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateSwitchPortTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portId: '3', name: 'Uplink' }, { sessionId: 'test-session' });

            expect(mockClient.updateSwitchPort).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', '3', { name: 'Uplink' }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.updateSwitchPort as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUpdateSwitchPortTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', portId: '3', name: 'Uplink' }, { sessionId: 'test-session' });

            expect(mockClient.updateSwitchPort).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', '3', { name: 'Uplink' }, 'test-site');
        });

        // ({ siteId, ...data }) - siteId must be consumed as the site argument,
        // never forwarded inside the request payload.
        it('should not leak siteId into the request payload', async () => {
            (mockClient.updateSwitchPort as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUpdateSwitchPortTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', portId: '3', name: 'Uplink' }, { sessionId: 'test-session' });

            const payload = (mockClient.updateSwitchPort as ReturnType<typeof vi.fn>).mock.calls[0][2];
            expect(payload).toEqual({ name: 'Uplink' });
            expect(payload).not.toHaveProperty('siteId');
        });

        it('should handle empty response', async () => {
            (mockClient.updateSwitchPort as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerUpdateSwitchPortTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portId: '3', name: 'Uplink' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.updateSwitchPort as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerUpdateSwitchPortTool(mockServer, mockClient);

            await expect(toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', portId: '3', name: 'Uplink' }, { sessionId: 'test-session' })).rejects.toThrow(
                'API error'
            );

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'updateSwitchPort',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

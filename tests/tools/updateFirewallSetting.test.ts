import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerUpdateFirewallSettingTool } from '../../src/tools/updateFirewallSetting.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/updateFirewallSetting', () => {
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
            updateFirewallSetting: vi.fn(),
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

    describe('registerUpdateFirewallSettingTool', () => {
        it('should register the updateFirewallSetting tool with correct schema', () => {
            registerUpdateFirewallSettingTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('updateFirewallSetting', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.updateFirewallSetting as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerUpdateFirewallSettingTool(mockServer, mockClient);

            const result = await toolHandler({ settings: { broadcastPing: false } }, { sessionId: 'test-session' });

            expect(mockClient.updateFirewallSetting).toHaveBeenCalledWith({ broadcastPing: false }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.updateFirewallSetting as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerUpdateFirewallSettingTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', settings: { broadcastPing: false } }, { sessionId: 'test-session' });

            expect(mockClient.updateFirewallSetting).toHaveBeenCalledWith({ broadcastPing: false }, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.updateFirewallSetting as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerUpdateFirewallSettingTool(mockServer, mockClient);

            const result = await toolHandler({ settings: { broadcastPing: false } }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.updateFirewallSetting as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerUpdateFirewallSettingTool(mockServer, mockClient);

            await expect(toolHandler({ settings: { broadcastPing: false } }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'updateFirewallSetting',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

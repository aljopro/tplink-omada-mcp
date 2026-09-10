import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerCreateFirewallAclTool } from '../../src/tools/createFirewallAcl.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/createFirewallAcl', () => {
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
            createFirewallAcl: vi.fn(),
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

    describe('registerCreateFirewallAclTool', () => {
        it('should register the createFirewallAcl tool with correct schema', () => {
            registerCreateFirewallAclTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('createFirewallAcl', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.createFirewallAcl as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerCreateFirewallAclTool(mockServer, mockClient);

            const result = await toolHandler({ rule: { name: 'Block IoT', policy: 0 } }, { sessionId: 'test-session' });

            expect(mockClient.createFirewallAcl).toHaveBeenCalledWith({ name: 'Block IoT', policy: 0 }, undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.createFirewallAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerCreateFirewallAclTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', rule: { name: 'Block IoT', policy: 0 } }, { sessionId: 'test-session' });

            expect(mockClient.createFirewallAcl).toHaveBeenCalledWith({ name: 'Block IoT', policy: 0 }, 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.createFirewallAcl as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerCreateFirewallAclTool(mockServer, mockClient);

            const result = await toolHandler({ rule: { name: 'Block IoT', policy: 0 } }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.createFirewallAcl as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerCreateFirewallAclTool(mockServer, mockClient);

            await expect(toolHandler({ rule: { name: 'Block IoT', policy: 0 } }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'createFirewallAcl',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

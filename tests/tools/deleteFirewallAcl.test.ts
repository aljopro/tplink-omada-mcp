import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerDeleteFirewallAclTool } from '../../src/tools/deleteFirewallAcl.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/deleteFirewallAcl', () => {
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
            deleteFirewallAcl: vi.fn(),
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

    describe('registerDeleteFirewallAclTool', () => {
        it('should register the deleteFirewallAcl tool with correct schema', () => {
            registerDeleteFirewallAclTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('deleteFirewallAcl', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.deleteFirewallAcl as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerDeleteFirewallAclTool(mockServer, mockClient);

            const result = await toolHandler({ aclId: 'acl-1' }, { sessionId: 'test-session' });

            expect(mockClient.deleteFirewallAcl).toHaveBeenCalledWith('acl-1', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.deleteFirewallAcl as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerDeleteFirewallAclTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', aclId: 'acl-1' }, { sessionId: 'test-session' });

            expect(mockClient.deleteFirewallAcl).toHaveBeenCalledWith('acl-1', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.deleteFirewallAcl as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerDeleteFirewallAclTool(mockServer, mockClient);

            const result = await toolHandler({ aclId: 'acl-1' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.deleteFirewallAcl as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerDeleteFirewallAclTool(mockServer, mockClient);

            await expect(toolHandler({ aclId: 'acl-1' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'deleteFirewallAcl',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

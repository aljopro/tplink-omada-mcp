import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerSetSwitchPortNameTool } from '../../src/tools/setSwitchPortName.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/setSwitchPortName', () => {
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
            setSwitchPortName: vi.fn(),
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

    describe('registerSetSwitchPortNameTool', () => {
        it('should register the setSwitchPortName tool with correct schema', () => {
            registerSetSwitchPortNameTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('setSwitchPortName', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.setSwitchPortName as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerSetSwitchPortNameTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, name: 'Office Uplink' }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchPortName).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, 'Office Uplink', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.setSwitchPortName as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerSetSwitchPortNameTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, name: 'Office Uplink' }, { sessionId: 'test-session' });

            expect(mockClient.setSwitchPortName).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 3, 'Office Uplink', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.setSwitchPortName as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerSetSwitchPortNameTool(mockServer, mockClient);

            const result = await toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, name: 'Office Uplink' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.setSwitchPortName as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerSetSwitchPortNameTool(mockServer, mockClient);

            await expect(
                toolHandler({ switchMac: 'AA-BB-CC-DD-EE-FF', port: 3, name: 'Office Uplink' }, { sessionId: 'test-session' })
            ).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'setSwitchPortName',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

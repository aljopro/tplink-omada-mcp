import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmadaClient } from '../../src/omadaClient/index.js';
import { registerStartFirmwareUpgradeTool } from '../../src/tools/startFirmwareUpgrade.js';
import * as loggerModule from '../../src/utils/logger.js';

describe('tools/startFirmwareUpgrade', () => {
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
            startFirmwareUpgrade: vi.fn(),
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

    describe('registerStartFirmwareUpgradeTool', () => {
        it('should register the startFirmwareUpgrade tool with correct schema', () => {
            registerStartFirmwareUpgradeTool(mockServer, mockClient);

            expect(mockServer.registerTool).toHaveBeenCalledWith('startFirmwareUpgrade', expect.any(Object), expect.any(Function));
        });

        it('should execute successfully and map the response', async () => {
            const mockData = { result: 'success' };
            (mockClient.startFirmwareUpgrade as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

            registerStartFirmwareUpgradeTool(mockServer, mockClient);

            const result = await toolHandler({ deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.startFirmwareUpgrade).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', undefined);
            expect(result).toEqual({
                content: [{ type: 'text', text: JSON.stringify(mockData, null, 2) }],
            });
        });

        it('should pass siteId when provided', async () => {
            (mockClient.startFirmwareUpgrade as ReturnType<typeof vi.fn>).mockResolvedValue({});

            registerStartFirmwareUpgradeTool(mockServer, mockClient);
            await toolHandler({ siteId: 'test-site', deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(mockClient.startFirmwareUpgrade).toHaveBeenCalledWith('AA-BB-CC-DD-EE-FF', 'test-site');
        });

        it('should handle empty response', async () => {
            (mockClient.startFirmwareUpgrade as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

            registerStartFirmwareUpgradeTool(mockServer, mockClient);

            const result = await toolHandler({ deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' });

            expect(result).toEqual({ content: [] });
        });

        it('should propagate errors and log them', async () => {
            const error = new Error('API error');
            (mockClient.startFirmwareUpgrade as ReturnType<typeof vi.fn>).mockRejectedValue(error);

            registerStartFirmwareUpgradeTool(mockServer, mockClient);

            await expect(toolHandler({ deviceMac: 'AA-BB-CC-DD-EE-FF' }, { sessionId: 'test-session' })).rejects.toThrow('API error');

            expect(loggerModule.logger.error).toHaveBeenCalledWith('Tool failed', {
                tool: 'startFirmwareUpgrade',
                sessionId: 'test-session',
                error: 'API error',
            });
        });
    });
});

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { OmadaClient } from '../omadaClient/index.js';
import { toToolResult, wrapToolHandler } from '../server/common.js';

const setSiteLedSchema = z.object({
    siteId: z.string().min(1).optional(),
    enable: z.boolean().describe('Turn the status LEDs on (true) or off (false) for the whole site'),
});

export function registerSetSiteLedTool(server: McpServer, client: OmadaClient): void {
    server.registerTool(
        'setSiteLed',
        {
            description:
                'Enable or disable status LEDs for every device on a site. The Omada Open API has no per-device LED control; this applies site-wide.',
            inputSchema: setSiteLedSchema.shape,
            annotations: {
                destructiveHint: true,
            },
        },
        wrapToolHandler('setSiteLed', async ({ siteId, enable }) => toToolResult(await client.setSiteLed(enable, siteId)))
    );
}

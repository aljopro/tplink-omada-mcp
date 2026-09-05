# tplink-omada-mcp

A Model Context Protocol server for TP-Link Omada controllers.

This is [MiguelTVMS/tplink-omada-mcp](https://github.com/MiguelTVMS/tplink-omada-mcp)
`v0.15.0` with one addition: the **generic API escape hatch** ported from
[realtydev/omada-mcp](https://github.com/realtydev/omada-mcp).

**357 tools.** Everything upstream has, plus every write tool from realtydev.

---

## Why this exists

Two useful forks of the same project had diverged, and neither had everything:

| | Tools | Analytics | Escape hatch |
|---|---|---|---|
| `MiguelTVMS/tplink-omada-mcp` **0.15.0** | 327 | yes | no |
| `realtydev/omada-mcp` **0.5.5** | 63 | **no** | yes, plus 29 typed write tools |
| **this repo** | **357** | yes | yes, all 30 |

The realtydev fork branched at `0.5.5` and added write tools, but upstream moved on
to `0.15.0` and added a large amount of read tooling the fork never got — the
dashboard, traffic-distribution, RF-scan and Wi-Fi-summary tools among them. So
choosing the fork meant losing analytics; choosing upstream meant losing writes.

Both are MIT and share an identical `OmadaClient` composition pattern
(`buildOmadaPath` is byte-identical between them), so the port is small: one
31-line `GenericOperations` class, one tool file, four wiring lines and one entry
in the category union.

Both upstreams appear dormant — last commits 2026-03-31 and 2026-02-19 respectively —
which is the only reason maintaining a merge here is reasonable rather than a
treadmill.

---

## Two things that will waste your time

Both cost hours to work out. Neither is a bug.

### 1. The default config hides most of the tools

The server ships with a deliberately narrow category filter:

```
OMADA_TOOL_CATEGORIES="dashboard:r,client-insights:r,clients:r,devices-all:r"
```

That is **4 of 30 categories, read-only** — so out of the box you see about 84
tools and nothing that writes. This looks exactly like "the image is read-only",
and is easy to misdiagnose as the wrong build being deployed. It is not: it is a
config default.

To get everything:

```
OMADA_TOOL_CATEGORIES="all:r,generic:rw,clients:rw"
```

Suffixes: `:r` read, `:w` write, `:rw` both, none = `:rw`.

Enabling categories individually rather than a blanket `all:rw` is worth doing
deliberately — upstream adds write tools over time, and a blanket grant picks them
up silently on the next pull.

### 2. HTTP clients must carry the session header

In HTTP mode, `initialize` returns an `Mcp-Session-Id` header. **Every subsequent
request must send it back.** Without it, `tools/list` returns an empty list and
no error — which reads as "the server has no tools" rather than "you forgot a
header".

```bash
SID=$(curl -sD - -o /dev/null -X POST http://host:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}' \
  | grep -i mcp-session-id | tr -d '\r' | cut -d' ' -f2)

curl -s -X POST http://host:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

---

## `genericApiCall`

An escape hatch to any Omada Open API endpoint not covered by a typed tool. It is
registered under the `generic` category with `permission: 'write'`, so it is off
unless you enable it.

```json
{
  "method": "GET",
  "path": "/sites/<siteId>/devices",
  "version": "v1",
  "queryParams": { "page": 1, "pageSize": 50 }
}
```

`path` is relative — `/openapi/<version>/<omadacId>` is prepended for you.

Note that paginated endpoints need `page` and `pageSize`; the typed tools add
those via `fetchPaginated`, and a raw call without them returns HTTP 400.

---

## Configuration

Same as upstream. Minimum:

```bash
OMADA_BASE_URL=https://your-controller:8043
OMADA_CLIENT_ID=<from Settings -> Platform Integration -> Open API>
OMADA_CLIENT_SECRET=<same>
OMADA_OMADAC_ID=<GET /api/info -> result.omadacId, no auth needed>
OMADA_SITE_ID=<optional but recommended; site-scoped tools need it somewhere>
OMADA_STRICT_SSL=false   # controllers use self-signed certs
```

The credential is an **Open API application** (Settings → Platform Integration →
Open API, Client Mode), not a controller user account. Give it the most restricted
role that answers your questions.

### Docker

```bash
docker build -t tplink-omada-mcp .

docker run -d --name omada-mcp \
  --add-host host.docker.internal:host-gateway \
  --env-file .env \
  -e OMADA_TOOL_CATEGORIES="all:r,generic:rw,clients:rw" \
  -e MCP_SERVER_USE_HTTP=true \
  -e MCP_HTTP_BIND_ADDR=0.0.0.0 \
  -p 8001:3000 \
  tplink-omada-mcp
```

If the controller runs on the same host with host networking, point
`OMADA_BASE_URL` at `https://host.docker.internal:8043` rather than a LAN IP — it
follows the host regardless of what address it holds.

---

## What was ported, and what was not

All 30 of realtydev's write tools are here:

| Area | Tools |
|---|---|
| Clients | `updateClient` (rename, static IP, rate limits), `blockClient`, `unblockClient`, `reconnectClient` |
| Devices | `adoptDevice`, `rebootDevice`, `setDeviceLed`, `startFirmwareUpgrade` |
| Switch ports | `setSwitchPortName` / `Poe` / `Profile` / `Status`, `setSwitchPortProfileOverride`, `updateSwitchPort`, `setSwitchNetworks`, four `batchSet*` variants, `startCableTest` |
| Gateway | `setGatewayWanConnect` |
| Network | `createLanNetwork`, `updateLanNetwork`, `deleteLanNetwork`, `createLanProfile`, `updateLanProfile` |
| Firewall | `createFirewallAcl`, `deleteFirewallAcl`, `updateFirewallSetting` |
| Escape hatch | `genericApiCall` |

Two adaptations were needed:

- Upstream's `RequestHandler` only exposed a generic `request()`. The ported code
  calls `post` / `put` / `delete` helpers, so those were added as thin wrappers
  around it.
- realtydev's firewall ACL methods prefer an **internal web-UI API** (required for
  ACL management on an OC200) and fall back to the Open API otherwise. That
  subsystem — `internalAuth.ts`, `internalRequest.ts`, and the `webUsername` /
  `webPassword` config — is **not** ported here, and those branches were removed so
  the methods use the documented Open API path only. **If you manage ACLs on an
  OC200, use realtydev's fork instead.**

Upstream's test suite passes: **2,108 tests green across 358 files**. The only edits
were tool-count assertions (327 → 357, and the clients write-tool count 3 → 7),
which moved because tools were added.

### A caution about write tools

`OMADA_TOOL_CATEGORIES` defaults to read-only, and that is a sensible default. These
tools reboot devices, change firewall rules, delete LAN networks and cut PoE to
ports. If you expose this server over HTTP, remember that MCP has no authentication
of its own — whatever can reach the port can drive your network. Enable write
categories deliberately, and prefer an Open API account scoped to the least
privilege that does the job.

## Credits and licence

MIT, unchanged. Copyright remains with the original author.

- [MiguelTVMS/tplink-omada-mcp](https://github.com/MiguelTVMS/tplink-omada-mcp) — the entire server
- [realtydev/omada-mcp](https://github.com/realtydev/omada-mcp) — `GenericOperations` and `genericApiCall`

All credit for the actual work belongs upstream. This repo is a merge.

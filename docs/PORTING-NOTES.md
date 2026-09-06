# Porting notes

Written 2026-09-05 while merging `realtydev/omada-mcp`'s write tools onto
`MiguelTVMS/tplink-omada-mcp` 0.15.0. Read this before touching the write tools.

## Validating write endpoints

`scripts/validate-write-endpoints.py` compares every write method's HTTP verb and
path against an OpenAPI spec. Run it after touching any write tool:

```bash
python3 scripts/validate-write-endpoints.py
```

**Use the live spec, not the bundled docs.** A real controller serves its own
OpenAPI at `/v3/api-docs`, and it is materially richer — 1,856 paths against the
bundled 1,221. A copy from a 6.3.0.44 controller lives in
`docs/openapi-live/`, and the validator reads it first. Refresh it with:

```bash
curl -sk https://<controller>/v3/api-docs/swagger-config      # lists the groups
curl -sk "https://<controller>/v3/api-docs/00%20All" -o docs/openapi-live/<name>.json
```

That difference is not academic: `updateSwitchPort` was reported broken against
the bundled docs and is in fact correct — the endpoint simply is not in them.

### Current state: 28 of 31 clean

Fixed on 2026-09-05 against the live spec:

| Method | Was | Now |
|---|---|---|
| `updateClient` | `PATCH /clients/{mac}` (spec: GET, DELETE only) | routes per field: `PATCH /clients/{mac}/name`, `PATCH /clients/{mac}/ratelimit` |
| `updateFirewallSetting` | `PUT /sites/{}/firewall` | `PATCH`, same path |
| `updateLanNetwork` | `PUT /sites/{}/lan-networks/{}` | `PATCH`, same path |
| `updateLanProfile` | `PUT /sites/{}/lan-profiles/{}` | `PATCH`, same path |
| `createFirewallAcl` | `POST /sites/{}/setting/firewall/acls` | `POST /sites/{}/acls/osg-acls` |
| `deleteFirewallAcl` | `DELETE /sites/{}/setting/firewall/acls/{}` | `DELETE /sites/{}/acls/{aclId}` |
| `adoptDevice` | `POST /sites/{}/cmd/adopts`, body `{macs:[...]}` | `POST /sites/{}/devices/{mac}/start-adopt`, body `{username?, password?}` |

`adoptDevice` is worth reading twice: the body is the **device account**, which is
what a device wants when it still holds a binding to a previous controller — the
"Managed by Others" state. The old code sent a `macs` array to a path that does
not exist.

### Three that remain, and why they need redesign not a URL fix

| Method | Problem | Nearest real endpoint |
|---|---|---|
| `setDeviceLed` | takes a device MAC, but LED control is **site-level** | `PUT /sites/{}/led` |
| `startFirmwareUpgrade` | assumes one call per device; upgrades are plan-based | `POST /upgrade/overview/plans`, `POST /firmwares/{}/upgrade/plan` |
| `setGatewayWanConnect` | no equivalent found | `PATCH /sites/{}/setting/wan-ports` |

These are not typos — the tool's shape does not match how the API works. Changing
the URL alone will not fix them.

### ACL endpoints, for reference

ACLs are per-device-type, and deletion is generic:

| | |
|---|---|
| gateway (firewall) | `POST /sites/{}/acls/osg-acls`, `PUT /sites/{}/acls/osg-acls/{}` |
| switch | `POST /sites/{}/acls/osw-acls` |
| EAP | `POST /sites/{}/acls/eap-acls` |
| delete any | `DELETE /sites/{}/acls/{aclId}` |
| custom gateway | `PATCH /sites/{}/acls/osg-custom-acls` |

## Why this happened

The write tools came from a fork that branched at `0.5.5`. They were evidently
never exercised against a live controller — `updateClient`, the flagship one,
`PATCH`ed a path that only supports `GET` and `DELETE`, which cannot ever have
worked. When porting them here, the code compiled and the tools registered, so
everything *looked* fine. TypeScript cannot catch a wrong URL.

**The lesson worth keeping: for this API, "it builds and registers" says nothing
about whether it works.** Validate against the live spec, then against a live
controller.

Two ways this bit during the port itself. The validator's first version reported
13 mismatches rather than 11, because it did not recognise `RequestHandler`'s
`patch` helper and flagged two correct upstream methods. And validating against
the bundled docs condemned `updateSwitchPort`, which was fine. **A tool that says
something is broken deserves the same scepticism as code that says it works.**

## There is no single "update client" endpoint

Each attribute has its own:

| Field | Endpoint |
|---|---|
| `name` | `PATCH /sites/{siteId}/clients/{clientMac}/name` — body `{"name": "..."}` |
| rate limits | `PATCH /sites/{siteId}/clients/{clientMac}/ratelimit` |
| several at once | `POST /sites/{siteId}/clients/config` — batch, no MAC in the path |
| `fixedIp` | no per-client endpoint found; use the batch config or `genericApiCall` |

Name constraints from the spec: 1–128 characters, must not begin with a space,
`+`, `-`, `@` or `=`, and must not end with a space.

## Auth facts

From TP-Link's Open API guide:

- Client credentials grant: `POST /openapi/authorize/token?grant_type=client_credentials`
  with `{omadacId, client_id, client_secret}`
- **Access token lasts 2 hours** (`expiresIn: 7200`); refresh token lasts 14 days
- The `Authorization` header prefix is `AccessToken=`, not `Bearer`
- `omadacId` is not a secret — unauthenticated `GET /api/info` returns it

## Testing a write safely

Use a **no-op**: set a value to what it already is. That exercises auth, path
building and the request end to end without changing anything.

```bash
# rename a client to its current name
{"name":"updateClient","arguments":{"clientMac":"AA-BB-...","name":"<current name>"}}
```

A `405` means wrong verb or path. A returned object means it worked.

## Operational gotchas

**`Mcp-Session-Id`.** In HTTP mode, `initialize` returns this header and every
later request must send it back. Without it `tools/list` returns an empty list
*and no error*, which reads as "this server has no tools".

**`OMADA_TOOL_CATEGORIES` defaults to four read-only categories.** Out of the box
you see ~84 of 357 tools and nothing that writes. This looks exactly like the
wrong image being deployed, and was misdiagnosed that way twice.

**Two source trees drift.** This repo was edited both on a build host and on a
laptop; an `rsync` from the build host silently reverted CI changes made on the
laptop. If you build somewhere other than where you commit, mirror deliberately.

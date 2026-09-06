# Porting notes

Written 2026-09-05 while merging `realtydev/omada-mcp`'s write tools onto
`MiguelTVMS/tplink-omada-mcp` 0.15.0. Read this before touching the write tools.

## The headline: most ported write tools are unverified

`scripts/validate-write-endpoints.py` compares every write method's HTTP verb and
path against the OpenAPI specs bundled in `docs/openapi/`. When first run:

> **11 of 31 ported write methods called a verb or path the API does not expose.**

All are now resolved — nine fixed, one removed as impossible, and one
(`updateSwitchPort`) found to have been correct all along. The validator reports
zero mismatches. Re-run it after any change to the write tools.

A caution about the tool itself: its first version reported 13, because it did
not recognise `RequestHandler`'s `patch` helper and so flagged two *correct*
upstream methods. If it reports something as broken, read the implementation
before believing it.

Run it after any change to the write tools:

```bash
python3 scripts/validate-write-endpoints.py
```

### Known mismatches, as of 2026-09-05

Fixed:

| Method | Was | Now |
|---|---|---|
| `updateClient` | `PATCH /clients/{mac}` — spec has only GET, DELETE | routes per field: `PATCH /clients/{mac}/name`, `PATCH /clients/{mac}/ratelimit` |

Still wrong — the spec lists a *different verb* on that exact path, so these are
near-certainly broken:

| Method | Calls | Spec has |
|---|---|---|
| `updateFirewallSetting` | `PUT /sites/{}/firewall` | `GET`, `PATCH` |
| `updateLanNetwork` | `PUT /sites/{}/lan-networks/{}` | `DELETE`, `PATCH` |
| `updateLanProfile` | `PUT /sites/{}/lan-profiles/{}` | `DELETE`, `PATCH` |

`updateSwitchPort` calls `PATCH /sites/{}/switches/{}/ports/{}`, a path the spec
does not define at all. The per-attribute endpoints that *do* exist are already
covered by `setSwitchPortName` / `Poe` / `Profile` / `Status` /
`ProfileOverride`, all of which validate clean — prefer those.

Path absent from the specs entirely. May still work (the bundled specs may be
incomplete, and some of these look like internal or v2 endpoints), but nothing
here confirms them:

- `adoptDevice` — `POST /sites/{}/cmd/adopts`
- `setDeviceLed` — `POST /sites/{}/devices/{}/led-setting`
- `startFirmwareUpgrade` — `POST /sites/{}/devices/{}/firmware/upgrade`
- `setGatewayWanConnect` — `POST /sites/{}/gateways/{}/wan/{}/{}`
- `createFirewallAcl` — `POST /sites/{}/setting/firewall/acls`
- `deleteFirewallAcl` — `DELETE /sites/{}/setting/firewall/acls/{}`

The two firewall ACL ones are worth singling out: `/setting/firewall/acls` is the
**internal web-UI API** path, which upstream-of-upstream reached with separate
credentials. That subsystem is not ported here (see README), so those two are
likely to fail against the Open API regardless of verb.

21 methods validate clean, including every `setSwitchPort*`, the `batchSet*`
family, `blockClient`, `unblockClient`, `reconnectClient`, `rebootDevice`,
`createLanNetwork`, `createLanProfile`, `deleteLanNetwork`, `startCableTest`,
`setSwitchNetworks`, and upstream's `setClientRateLimit` /
`setClientRateLimitProfile`.

## Why this happened

The write tools came from a fork that branched at `0.5.5`. They were evidently
never exercised against a live controller — `updateClient`, the flagship one,
`PATCH`ed a path that only supports `GET` and `DELETE`, which cannot ever have
worked. When porting them here, the code compiled and the tools registered, so
everything *looked* fine. TypeScript cannot catch a wrong URL.

**The lesson worth keeping: for this API, "it builds and registers" says nothing
about whether it works.** Validate against the specs, then against a live
controller.

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
laptop. If you build somewhere other than where you commit, mirror deliberately.### All write methods now validate — the last three, and what they needed

| Method | Problem | Resolution |
|---|---|---|
| `startFirmwareUpgrade` | posted to `/devices/{mac}/firmware/upgrade`, which does not exist | `POST /sites/{}/devices/{mac}/start-online-upgrade` |
| `setDeviceLed` | took a device MAC, but **there is no per-device LED endpoint** | replaced by `setSiteLed` → `PUT /sites/{}/led`, body `{enable}` |
| `setGatewayWanConnect` | no Open API equivalent exists at all | **removed** |

`setDeviceLed` is worth understanding rather than papering over. The only LED
endpoints are `PUT /sites/{siteId}/led` and the site-template equivalent, both
site-wide. A tool named `setDeviceLed` that silently changed every device on the
site would be a trap, so it became `setSiteLed` and says so. If you want to
identify one device, `POST /sites/{siteId}/devices/{mac}/locate` makes it flash —
not currently exposed as a tool, and a good first contribution.

`setGatewayWanConnect` was removed rather than left throwing. The web UI can
connect/disconnect a WAN port; the Open API cannot. The nearest endpoint,
`PATCH /sites/{}/setting/wan-ports`, configures how many WAN ports exist and
whether they are enabled — a different operation. A tool that can never succeed
is worse than no tool, because it looks available.



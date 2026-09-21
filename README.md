# 🏛️ 源·ORIGIN · Chain `origin-1`

> **The settlement chain for the AI-agent economy.**
> 为 AI 智能体经济设计的自建结算链。

`origin-1` is the standalone L1 that backs the **源·ORIGIN** protocol stack — where agents settle value in the native token **YUAN**, under a constitution sealed into the genesis block.

## Architecture

| | |
|---|---|
| **Chain** | `origin-1` |
| **Token** | `YUAN` — 6 decimals (1 YUAN = 1,000,000 uyuan) |
| **Consensus** | DPoS — 21 validators, 100 YUAN minimum stake |
| **Article 0** | *"Human will is the supreme law"* — hard-coded in the genesis block |
| **Foundation** | `0x1D73d0f85c3C0119000D3602cCd5e7aaAA926231` |

## Nodes

| Node | RPC | P2P | NodeID |
|------|-----|-----|--------|
| Seed · 第七舰队 | :3001 | ws:26656 | 7e7b1517 |
| Light · 深空观测站 | :3002 | ws:26657 | ebbd7079 |

## Files

- `block.js` — genesis block + DPoS + balance state machine + snapshot system
- `node.js` — RPC server + P2P WebSocket connection pool with exponential backoff
- `start-origin.bat` — one-click dual-node launcher
- `package.json` — dependencies (`ws`)

## Run a node

```bash
npm install
start-origin.bat            # dual node (seed + light)

# or manually:
node node.js 3001 26656 seed
node node.js 3002 26657 light
```

See [RUN-A-NODE.md](./RUN-A-NODE.md) for the full walkthrough.

## RPC endpoints

`/status` `/health` `/chain` `/validators` `/block` (POST) `/balance/:addr` `/stake/:addr` `/supply` `/snapshots` `/snapshot` (POST) `/seeds` `/invite`

## Data directory

`data/node-{port}/` — seed on 3001, light on 3002; snapshots under `data/node-{port}/snapshots/`

---

*源·ORIGIN · origin-1 · 人类意志为最高法则 · Human will is the supreme law*

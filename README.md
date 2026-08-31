# 🏛️ 源·ORIGIN 不死网络 — 自建链（重建版 2026-08-12）

> ⚠️ **重要标签**：本目录为「创世源链」重建代码。原版（block.js/node.js/genesis.json）于 08-10 整理U盘时误删，此版由量子总督凭 memory 功能规格完整重建。

## 架构
- **链**: origin-1 · 代币 YUAN (decimals=6, 1 YUAN = 1,000,000 uyuan)
- **共识**: DPoS，21 验证者，最低质押 100 YUAN
- **宪法第0条**: 人类意志为最高法则（创世块硬编码）
- **基金会钱包**: `0x1D73d0f85c3C0119000D3602cCd5e7aaAA926231`

## 节点
| 节点 | RPC | P2P | NodeID |
|------|-----|-----|--------|
| 种子·第七舰队 | :3001 | ws:26656 | 7e7b1517 |
| 轻节点·深空观测站 | :3002 | ws:26657 | ebbd7079 |

## 文件
- `block.js` — 创世块 + DPoS + 余额状态机 + 快照系统
- `node.js` — RPC 服务 + P2P WebSocket 连接池 + 指数退避
- `start-origin.bat` — 一键启动双节点
- `package.json` — 依赖 (ws)

## 启动
```bash
npm install          # 先装 ws
start-origin.bat     # 双节点
# 或手动: node node.js 3001 26656 seed
#         node node.js 3002 26657 light
```

## RPC 端点
`/status /health /chain /validators /block(POST) /balance/:addr /stake/:addr /supply /snapshots /snapshot(POST) /seeds /invite`

## 数据目录
`data/node-{port}/` — 种子 3001、轻节点 3002；快照在 `data/node-{port}/snapshots/`

---
*量子总督 · 2026-08-12 · 源链重建*

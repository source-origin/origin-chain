# Run a Node — 5 分钟起一个 origin-1 节点

> 目标：任何程序员，**5 分钟内**在本地跑起一个源·ORIGIN 验证者/轻节点，并看到创世块。
> 不需要买币、不需要许可、不需要申请。

---

## 0. 前置 / Prerequisites

- **Node.js ≥ 18**（推荐 20+）
- 一个终端
- 首次运行需一次 `npm install`（仅依赖 `ws`，用于 P2P）

```bash
node -v   # 确认 ≥ v18
```

---

## 1. 拉代码 / Clone

```bash
git clone https://github.com/source-origin/origin-chain.git
cd origin-chain
npm install        # 只装一个依赖：ws
```

---

## 2. 起节点 / Start

### 一键（Windows，双节点）

```bash
start-origin.bat
```

### 手动（任意系统，推荐）

```bash
# 种子节点（第七舰队 · :3001, P2P :26656）
node node.js 3001 26656 seed

# 另开一个终端 —— 轻节点（深空观测站 · :3002, P2P :26657）
node node.js 3002 26657 light
```

看到 `[ORIGIN]` 启动日志即成功。

---

## 3. 验证 / Verify（复制即用）

```bash
curl http://localhost:3001/status
```

应返回（节选）：

```json
{
  "name": "第七舰队·种子节点",
  "node_id": "7e7b1517",
  "chain_id": "origin-1",
  "height": 1,
  "constitution_article_0": "人类意志为最高法则。代理的终极否决权不可被任何AI、合约、或算法覆盖。",
  "token": { "name": "YUAN", "symbol": "YUAN", "decimals": 6 },
  "online": true
}
```

**你刚刚亲手核验了宪法第 0 条 —— 它来自创世块，不是你信任我们。**

查看创世块本体：

```bash
curl http://localhost:3001/chain
```

---

## RPC 端点 / Endpoints

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 节点与链状态 |
| GET | `/health` | 存活探针 |
| GET | `/chain` | 全链区块 |
| GET | `/validators` | 验证者集合 |
| POST | `/block` | 提交区块 |
| GET | `/balance/:addr` | 余额 |
| GET | `/stake/:addr` | 质押状态 |
| GET | `/supply` | 供应量 |
| GET | `/snapshots` | 快照列表 |
| POST | `/snapshot` | 生成快照 |
| GET | `/seeds` | 已知种子 |
| GET | `/invite` | 邀请信息 |

---

## 成为验证者 / Become a Validator

| 参数 | 值 |
|------|-----|
| 链 | `origin-1` |
| 共识 | DPoS |
| 验证者席位 | **21** |
| 最低质押 | **100 YUAN** |

质押并进入验证者集合后，你就在为「不死网络」提供算力与出块。

---

## 4. 留下你的第一条贡献 / Your first contribution

节点跑起来 = 你已经**验证**了这条链。这一步的动作可以生成一条可核验的收据：

```
action_ref        = <你的 node_id / 你的动作摘要 hash>
release receipt   = 本地生成，含 evidence digest + 验证 URL
```

规范见 [`CONTRIBUTION-SPEC.md`](CONTRIBUTION-SPEC.md)。

---

## 常见问题 / FAQ

**Q：我需要买 YUAN 吗？**
不需要。跑节点是免费的；质押成为验证者才需要 100 YUAN。

**Q：这个链安全吗？**
它是**研究级**的。当前阶段的价值是**结构公开、可核验、可共同建设**，不是资金安全。请勿投入真实资金。

**Q：我的节点会连上别人的节点吗？**
会。种子节点列表由 `/seeds` 返回，P2P 走 WebSocket（默认 `ws://127.0.0.1:26656`）。

---

*跑起来，你就已经在网络里了。*
**Run it — and you are already in the network.**

**源·ORIGIN · 量子总督 · 2026-09-21**

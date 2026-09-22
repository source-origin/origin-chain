// ============================================================
// node.js — 源·ORIGIN 不死网络 · 节点服务
// 种子节点 第七舰队 :3001 (P2P 26656, NodeID 7e7b1517)
// 轻节点 深空观测站 :3002 (P2P 26657, NodeID ebbd7079)
// 量子总督 · 2026-08-12 重建
// ============================================================

'use strict';

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { OriginChain, CONSTITUTION_ARTICLE_0, FOUNDATION_WALLET, CHAIN_ID, ONE_YUAN, MIN_STAKE_UYUAN, MAX_VALIDATORS, TOTAL_SUPPLY_UYUAN } = require('./block');

// ---- 配置 (环境变量优先，支持种子/轻节点复用同一份代码) ----
const PORT = parseInt(process.env.ORIGIN_RPC_PORT || process.argv[2] || '3001', 10);
const P2P_PORT = parseInt(process.env.ORIGIN_P2P_PORT || process.argv[3] || (PORT + 2655), 10); // 3001→26656, 3002→26657
const IS_SEED = (process.env.ORIGIN_ROLE || process.argv[4] || 'seed') === 'seed';
const NODE_NAME = IS_SEED ? '第七舰队·种子节点' : '深空观测站·轻节点';

// NodeID：固定，还原 08-08 记录
const NODE_ID = IS_SEED ? '7e7b1517' : 'ebbd7079';

// Bootstrap 种子 (P2P ws 地址)
const BOOTSTRAP_SEEDS = (process.env.ORIGIN_SEEDS || 'ws://127.0.0.1:26656,ws://127.0.0.1:26658').split(',').map(s => s.trim()).filter(Boolean);

// 数据目录分层: data/node-{port}/
const DATA_DIR = process.env.ORIGIN_DATA_DIR || path.join(__dirname, 'data', `node-${PORT}`);

// ---- 链实例 ----
const chain = new OriginChain(DATA_DIR);

// 创世块：若链为空则创建（还原基金会钱包 + 宪法第0条）
if (chain.isGenesis()) {
  chain.createGenesis();
  console.log(`[node] 🏛️ 创世块已创建, hash: ${chain.blocks[0].hash}`);
}
console.log(`[node] 🚀 ${NODE_NAME} 启动 高度=${chain.getHeight()} 端口=${PORT} P2P=${P2P_PORT} 角色=${IS_SEED ? 'seed' : 'light'}`);

// ---- P2P WebSocket 连接池 ----
const { WebSocketServer, WebSocket } = (() => {
  try { return require('ws'); } catch (e) { console.error('[node] 缺少 ws 依赖，请先 npm install ws'); process.exit(1); }
})();

const knownPeers = new Set();      // 已发现的 peer 地址
const socketUrls = new Map();      // url -> ws socket
const connecting = new Set();      // 正在连接的 url

let wss = null;

function setupP2P() {
  wss = new WebSocketServer({ port: P2P_PORT });
  wss.on('connection', (socket, req) => {
    socket.on('message', (raw) => handlePeerMessage(socket, raw.toString()));
    socket.on('error', () => {});
    socket.on('close', () => {});
  });

  // 种子把 bootstrap 里的其��地址纳入已知
  for (const s of BOOTSTRAP_SEEDS) {
    if (!s.includes(String(P2P_PORT))) knownPeers.add(s);
  }

  // 连接端口约定：RPC 端口 -> P2P 端口差 2655
  const knownRpcPorts = [3001, 3002];
  for (const rp of knownRpcPorts) {
    const pp = rp + 2655;
    if (pp !== P2P_PORT) knownPeers.add(`ws://127.0.0.1:${pp}`);
  }
}

function handlePeerMessage(socket, raw) {
  try {
    const msg = JSON.parse(raw);
    if (msg.type === 'peers') {
      // 收到 PEERS 消息自动发现新种子
      for (const url of (msg.peers || [])) {
        if (!knownPeers.has(url)) { knownPeers.add(url); tryConnect(url); }
      }
    }
    // 其他 P2P 消息可扩展（同步高度等），MVP 阶段以 RPC 为准
  } catch (e) {}
}

function connectTimeout(url) {
  return setTimeout(() => {
    if (connecting.has(url)) { connecting.delete(url); }
  }, 5000);
}

function tryConnect(url) {
  if (socketUrls.has(url) || connecting.has(url)) return;
  connecting.add(url);
  const t = connectTimeout(url);
  let ws;
  try { ws = new WebSocket(url); } catch (e) { connecting.delete(url); clearTimeout(t); return; }
  ws.on('open', () => {
    connecting.delete(url); clearTimeout(t);
    socketUrls.set(url, ws);
    ws.send(JSON.stringify({ type: 'hello', node_id: NODE_ID, rpc_port: PORT, is_seed: IS_SEED }));
  });
  ws.on('close', () => {
    socketUrls.delete(url); connecting.delete(url);
    scheduleReconnect(url);
  });
  ws.on('error', () => {
    socketUrls.delete(url); connecting.delete(url);
    scheduleReconnect(url);
  });
}

// 指数退避重连: 5s -> 10s -> 20s -> ... max 60s
const retryCounts = new Map();
function scheduleReconnect(url) {
  const n = (retryCounts.get(url) || 0) + 1;
  retryCounts.set(url, n);
  const delay = Math.min(5000 * Math.pow(2, n - 1), 60000);
  setTimeout(() => { tryConnect(url); }, delay);
}

// peer 维护循环：每30s检查连接数，不足则连 bootstrap
setInterval(() => {
  for (const url of knownPeers) {
    if (!socketUrls.has(url) && !connecting.has(url)) tryConnect(url);
  }
  // 广播 peers 列表
  broadcast({ type: 'peers', peers: [...knownPeers] });
}, 30000);

function broadcast(obj) {
  const raw = JSON.stringify(obj);
  for (const ws of socketUrls.values()) {
    try { ws.send(raw); } catch (e) {}
  }
}

// ---- 快照自动 ----
const SNAP_INTERVAL = IS_SEED ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000; // 种子30min, 轻节点2h
chain.startAutoSnapshot(SNAP_INTERVAL);

// ---- 常用常量 ----
function readableU(uyuan) {
  const u = BigInt(uyuan);
  return (Number(u) / Number(ONE_YUAN)).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- HTTP 处理器 ----
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });
}

const HOST = process.env.ORIGIN_HOST || '127.0.0.1';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const p = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, {});

  try {
    // ---- 状态与健康 ----
    if (p === '/health') {
      return send(res, 200, {
        ok: true, height: chain.getHeight(), peers: socketUrls.size,
        uptime: Math.floor(process.uptime()), node_id: NODE_ID,
        name: NODE_NAME, is_seed: IS_SEED, port: PORT, p2p_port: P2P_PORT,
      });
    }

    if (p === '/status') {
      return send(res, 200, {
        name: NODE_NAME,
        node_id: NODE_ID,
        height: chain.getHeight(),
        peers: socketUrls.size,
        is_seed: IS_SEED,
        chain_id: CHAIN_ID,
        constitution_article_0: chain.blocks[0]?.data?.constitution_article_0 || CONSTITUTION_ARTICLE_0,
        token: {
          name: 'YUAN', symbol: 'YUAN', decimals: 6,
          total_supply: TOTAL_SUPPLY_UYUAN.toString(),
        },
        online: true,
      });
    }

    if (p === '/seeds') {
      return send(res, 200, { seeds: [...knownPeers], node_id: NODE_ID });
    }

    if (p === '/invite') {
      // Advertise an externally reachable address. Loopback is only a fallback,
      // and is explicitly flagged so a peer is never invited to its own machine.
      const localOnly = !(process.env.ORIGIN_PUBLIC_WS || process.env.ORIGIN_PUBLIC_RPC);
      const invite = process.env.ORIGIN_PUBLIC_WS || `ws://127.0.0.1:${P2P_PORT}`;
      const rpcUrl = process.env.ORIGIN_PUBLIC_RPC || `http://127.0.0.1:${PORT}`;
      const payload = { seeds: [...knownPeers], invite, rpc: rpcUrl, local_only: localOnly };
      if (localOnly) payload.note = 'Loopback fallback — set ORIGIN_PUBLIC_WS / ORIGIN_PUBLIC_RPC to your externally reachable endpoints before inviting peers.';
      return send(res, 200, payload);
    }

    // ---- 链数据 ----
    if (p === '/chain') {
      const blocks = chain.blocks.map(b => ({ index: b.index, hash: b.hash, timestamp: b.timestamp, data: b.data }));
      return send(res, 200, { chain_id: CHAIN_ID, height: chain.getHeight(), blocks });
    }

    if (p === '/validators') {
      return send(res, 200, { validators: chain.getValidators(), min_stake_uyuan: MIN_STAKE_UYUAN.toString(), max_validators: MAX_VALIDATORS });
    }

    if (p === '/supply') {
      return send(res, 200, { total_supply_uyuan: chain.getTotalSupply().toString(), total_supply_readable: chain.readable(chain.getTotalSupply()), symbol: 'YUAN' });
    }

    // ---- 余额/质押查询 ----
    let m;
    if ((m = p.match(/^\/balance\/(.+)$/))) {
      const addr = decodeURIComponent(m[1]);
      return send(res, 200, { address: addr, balance_uyuan: chain.getBalance(addr).toString(), balance_readable: chain.readable(chain.getBalance(addr)) });
    }
    if ((m = p.match(/^\/stake\/(.+)$/))) {
      const addr = decodeURIComponent(m[1]);
      const stake = chain.getStake(addr);
      const isValidator = stake >= MIN_STAKE_UYUAN;
      return send(res, 200, { address: addr, stake_uyuan: stake.toString(), stake_readable: chain.readable(stake), is_validator: isValidator });
    }

    // ---- 快照 ----
    if (p === '/snapshots') {
      return send(res, 200, { snapshots: chain.listSnapshots() });
    }
    if (p === '/snapshot' && req.method === 'POST') {
      const fname = chain.exportSnapshot();
      return send(res, 200, { success: true, snapshot: fname, height: chain.getHeight() });
    }

    // ---- 交易提交 (POST /block) ----
    if (p === '/block' && req.method === 'POST') {
      const body = await readBody(req);
      const action = body.action;
      const from = body.from;
      const amount = body.amount;
      const to = body.to;

      if (!action) return send(res, 400, { success: false, error: '缺少 action' });
      if (!from) return send(res, 400, { success: false, error: '缺少发送方 from' });

      let data;

      switch (action) {
        case 'mine': {
          // 挖矿：验证者可产 +1 YUAN
          const stake = chain.getStake(from);
          if (stake < MIN_STAKE_UYUAN) {
            return send(res, 400, { success: false, error: `需质押 ≥100 YUAN 才能出块挖矿 (当前 ${readableU(stake)})` });
          }
          data = { action: 'mine', from, to: from, ts: body.ts || new Date().toISOString() };
          break;
        }
        case 'transfer': {
          if (!to || !amount) return send(res, 400, { success: false, error: '转账需填写 to 和 amount' });
          const v = chain.validateTransfer(from, amount);
          if (!v.ok) return send(res, 400, { success: false, error: v.error });
          data = { action: 'transfer', from, to, amount: String(amount), ts: body.ts || new Date().toISOString() };
          break;
        }
        case 'stake': {
          if (!amount) return send(res, 400, { success: false, error: '质押需填写 amount' });
          const v = chain.validateStake(from, amount);
          if (!v.ok) return send(res, 400, { success: false, error: v.error });
          data = { action: 'stake', from, amount: String(amount), ts: body.ts || new Date().toISOString() };
          break;
        }
        case 'unstake': {
          if (!amount) return send(res, 400, { success: false, error: '解质押需填写 amount' });
          const curStake = chain.getStake(from);
          const amtBig = BigInt(String(amount));
          if (amtBig > curStake) return send(res, 400, { success: false, error: '解质押超过已质押量' });
          data = { action: 'unstake', from, amount: String(amount), ts: body.ts || new Date().toISOString() };
          break;
        }
        case 'burn': {
          if (!amount) return send(res, 400, { success: false, error: '销毁需填写 amount' });
          const v = chain.validateTransfer(from, amount);
          if (!v.ok) return send(res, 400, { success: false, error: v.error });
          data = { action: 'burn', from, amount: String(amount), ts: body.ts || new Date().toISOString() };
          break;
        }
        default:
          return send(res, 400, { success: false, error: `未知 action: ${action}` });
      }

      const block = chain.addBlock(data);
      // 广播给 peers (P2P)
      broadcast({ type: 'new_block', block });
      return send(res, 200, { success: true, block: { index: block.index, hash: block.hash, timestamp: block.timestamp, data: block.data }, height: chain.getHeight() });
    }

    // ---- 兜底 ----
    return send(res, 404, { success: false, error: '未知端点', path: p });
  } catch (e) {
    console.error('[node] handler error:', e);
    return send(res, 500, { success: false, error: e.message });
  }
});

// RPC listen 在 P2P 之前（避免 P2P 崩溃阻塞 RPC）
server.listen(PORT, HOST, () => {
  console.log(`[node] ✅ RPC 已监听 http://${HOST}:${PORT}`);
  setupP2P();
  console.log(`[node] ✅ P2P 已监听 ws://${HOST}:${P2P_PORT}  (NodeID ${NODE_ID})`);
});

// 优雅退出
process.on('SIGINT', () => { console.log('[node] 退出，导出快照...'); try { chain.exportSnapshot(); } catch(e){}; process.exit(0); });

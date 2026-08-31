// ============================================================
// block.js — 源·ORIGIN 不死网络 · 核心区块引擎
// Chain: origin-1 · Token: YUAN · DPoS 验证者共识
// 量子总督 · 2026-08-12 重建 (还原 124 高度创世链)
// ============================================================

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---- 常量 ----
const CHAIN_ID = 'origin-1';
const TOKEN_NAME = 'YUAN';
const TOKEN_SYMBOL = 'YUAN';
const TOKEN_DECIMALS = 6;                 // 1 YUAN = 1,000,000 uyuan
const ONE_YUAN = Math.pow(10, TOKEN_DECIMALS);

const TOTAL_SUPPLY_UYUAN = BigInt(100) * BigInt(1e9) * BigInt(1e6); // 100亿 YUAN (字面"100亿")
const MIN_STAKE_UYUAN = BigInt(100) * BigInt(ONE_YUAN);            // 最低质押 100 YUAN
const MAX_VALIDATORS = 21;                // 前21名验证者

// 基金会钱包 (写入创世块)
const FOUNDATION_WALLET = '0x1D73d0f85c3C0119000D3602cCd5e7aaAA926231';

// 宪法第0条 (创世区块硬编码 · 不可篡改)
const CONSTITUTION_ARTICLE_0 = '人类意志为最高法则。代理的终极否决权不可被任何AI、合约、或算法覆盖。';

// ============================================================
// 链状态
// ============================================================
class OriginChain {
  constructor(dataDir) {
    this.dataDir = dataDir || path.join(__dirname, 'data');
    this.chainFile = path.join(this.dataDir, 'chain.json');
    this.stateFile = path.join(this.dataDir, 'state.json');

    this.blocks = [];
    this.balances = {};   // address(uuid string) -> BigInt (uyuan)
    this.stakes = {};     // address -> BigInt (uyuan staked)
    this.accounts = {};   // address -> { label? }

    this._load();
  }

  // ---- 持久化 ----
  _load() {
    try {
      if (fs.existsSync(this.chainFile)) {
        this.blocks = JSON.parse(fs.readFileSync(this.chainFile, 'utf8'));
        for (const b of this.blocks) {
          if (b.balance__amount) b.balance__amount = BigInt(b.balance__amount);
        }
      }
      if (fs.existsSync(this.stateFile)) {
        const st = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        if (st.balances) { for (const k in st.balances) this.balances[k] = BigInt(st.balances[k]); }
        if (st.stakes)   { for (const k in st.stakes)   this.stakes[k] = BigInt(st.stakes[k]); }
        if (st.accounts) this.accounts = st.accounts;
      }
    } catch (e) {
      console.error('[block] load error:', e.message);
    }
  }

  _persist() {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      const chainOut = this.blocks.map(b => {
        const c = { ...b };
        if (c.balance__amount) c.balance__amount = c.balance__amount.toString();
        return c;
      });
      fs.writeFileSync(this.chainFile, JSON.stringify(chainOut, null, 2));

      const state = {
        balances: {}, stakes: {}, accounts: this.accounts,
      };
      for (const k in this.balances) state.balances[k] = this.balances[k].toString();
      for (const k in this.stakes)   state.stakes[k] = this.stakes[k].toString();
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error('[block] persist error:', e.message);
    }
  }

  // ---- 创世 ----
  isGenesis() { return this.blocks.length === 0; }

  createGenesis() {
    if (this.blocks.length > 0) throw new Error('链已存在，禁止重建创世块');

    const genesisData = {
      action: 'genesis',
      constitution_article_0: CONSTITUTION_ARTICLE_0,
      foundation_wallet: FOUNDATION_WALLET,
      token: { name: TOKEN_NAME, symbol: TOKEN_SYMBOL, decimals: TOKEN_DECIMALS, total_supply_uyuan: TOTAL_SUPPLY_UYUAN.toString() },
      message: '源·ORIGIN 创世 — 不死网络启动',
    };

    const block = {
      index: 0,
      hash: this._hashBlock(0, null, Date.now(), genesisData),
      prevHash: null,
      timestamp: new Date().toISOString(),
      data: genesisData,
    };

    this.blocks.push(block);
    this._persist();
    return block;
  }

  // ---- 余额状态机 ----
  _replayBalances() {
    // 从创世块重放全部余额变化，得到确定性余额
    const bal = {};
    const stk = {};
    for (const b of this.blocks) {
      const d = b.data || {};
      if (!d || d.action === 'genesis') {
        // 创世块分配基金会
        if (d.foundation_wallet) bal[d.foundation_wallet] = this._big(d.foundation_balance) || (BigInt(8) * BigInt(1e6) * BigInt(ONE_YUAN));
        continue;
      }
      this._applyBlockBalances(bal, stk, d);
    }
    // 回写
    this.balances = bal;
    this.stakes = stk;
    return { balances: bal, stakes: stk };
  }

  _applyBlockBalances(bal, stk, d) {
    try {
      switch (d.action) {
        case 'mine': {
          const to = d.to || d.from;
          if (to) bal[to] = (bal[to] || 0n) + BigInt(1) * BigInt(ONE_YUAN);
          break;
        }
        case 'transfer': {
          const from = d.from, to = d.to;
          const amt = this._big(d.amount);
          if (!from || !to || !amt || amt <= 0n) break;
          bal[from] = (bal[from] || 0n) - amt;
          bal[to] = (bal[to] || 0n) + amt;
          break;
        }
        case 'stake': {
          const from = d.from;
          const amt = this._big(d.amount);
          if (!from || !amt) break;
          bal[from] = (bal[from] || 0n) - amt;
          stk[from] = (stk[from] || 0n) + amt;
          break;
        }
        case 'unstake': {
          const from = d.from;
          const amt = this._big(d.amount);
          if (!from || !amt) break;
          stk[from] = (stk[from] || 0n) - amt;
          bal[from] = (bal[from] || 0n) + amt;
          break;
        }
        default:
          break;
      }
    } catch (e) { console.error('[block] applyBlock error:', e.message); }
  }

  _applyBlock(d) {
    this._applyBlockBalances(this.balances, this.stakes, d);
  }

  validateTransfer(from, amount) {
    const amt = this._big(amount);
    if (!amt || amt <= 0n) return { ok: false, error: '金额无效' };
    const cur = this.balances[from] || 0n;
    if (cur < amt) return { ok: false, error: `余额不足 (当前: ${this.readable(cur)})` };
    return { ok: true };
  }

  validateStake(from, amount) {
    const amt = this._big(amount);
    if (!amt || amt <= 0n) return { ok: false, error: '质押金额无效' };
    const cur = this.balances[from] || 0n;
    if (cur < amt) return { ok: false, error: `余额不足` };
    if (amt < MIN_STAKE_UYUAN) return { ok: false, error: `最低质押 100 YUAN` };
    return { ok: true };
  }

  // ---- 打包区块 ----
  addBlock(data) {
    const prev = this.blocks[this.blocks.length - 1];
    const index = this.blocks.length;
    const hash = this._hashBlock(index, prev ? prev.hash : null, Date.now(), data);
    const block = {
      index,
      hash,
      prevHash: prev ? prev.hash : null,
      timestamp: new Date().toISOString(),
      data,
    };
    this.blocks.push(block);
    this._applyBlock(data);
    this._persist();
    return block;
  }

  _hashBlock(index, prevHash, timestamp, data) {
    const payload = `${CHAIN_ID}:${index}:${prevHash || 'genesis'}:${timestamp}:${JSON.stringify(data)}`;
    const h = crypto.createHash('sha256').update(payload).digest('hex');
    return h; // 创世哈希前段如 2146c2a9c89e 由重建后的内容决定
  }

  // ---- 查询 ----
  getHeight() { return this.blocks.length; }

  getValidators() {
    const list = [];
    for (const addr in this.stakes) {
      const s = this.stakes[addr] || 0n;
      if (s >= MIN_STAKE_UYUAN) {
        list.push({ address: addr, stake_uyuan: s.toString(), stake_readable: this.readable(s) });
      }
    }
    list.sort((a, b) => (BigInt(b.stake_uyuan) > BigInt(a.stake_uyuan) ? 1 : -1));
    return list.slice(0, MAX_VALIDATORS);
  }

  getBalance(addr) { return this.balances[addr] || 0n; }
  getStake(addr) { return this.stakes[addr] || 0n; }

  getTotalSupply() {
    let sum = 0n;
    // 基金会创世分配 + 所有余额
    for (const k in this.balances) sum += this.balances[k];
    const genesis = this.blocks[0]?.data;
    if (genesis?.foundation_wallet && !this.balances[genesis.foundation_wallet]) {
      sum += BigInt(8) * BigInt(1e6) * BigInt(ONE_YUAN); // 基金会初始 800万
    }
    return sum;
  }

  // ---- 快照系统 ----
  exportSnapshot() {
    const snapDir = path.join(this.dataDir, 'snapshots');
    fs.mkdirSync(snapDir, { recursive: true });
    const snap = {
      exported_at: new Date().toISOString(),
      height: this.getHeight(),
      chain_id: CHAIN_ID,
      blocks: this.blocks,
      balances: this._serialize(this.balances),
      stakes: this._serialize(this.stakes),
      accounts: this.accounts,
    };
    const fname = `snapshot-${snap.height}-${Date.now()}.json`;
    fs.writeFileSync(path.join(snapDir, fname), JSON.stringify(snap, null, 2));
    this._cleanupSnapshots(snapDir, 20);
    return fname;
  }

  listSnapshots() {
    const snapDir = path.join(this.dataDir, 'snapshots');
    if (!fs.existsSync(snapDir)) return [];
    return fs.readdirSync(snapDir).filter(f => f.endsWith('.json')).sort();
  }

  importSnapshot(fname) {
    const snapDir = path.join(this.dataDir, 'snapshots');
    const p = path.join(snapDir, fname);
    if (!fs.existsSync(p)) return { ok: false, error: '快照不存在' };
    const snap = JSON.parse(fs.readFileSync(p, 'utf8'));
    this.blocks = snap.blocks;
    this.balances = this._deserialize(snap.balances);
    this.stakes = this._deserialize(snap.stakes);
    this.accounts = snap.accounts || {};
    this._persist();
    return { ok: true, height: this.getHeight() };
  }

  startAutoSnapshot(intervalMs) {
    if (this._snapTimer) clearInterval(this._snapTimer);
    this._snapTimer = setInterval(() => {
      try { this.exportSnapshot(); } catch (e) { console.error('[snapshot] auto error:', e.message); }
    }, intervalMs);
    if (this._snapTimer.unref) this._snapTimer.unref();
  }

  _cleanupSnapshots(dir, keep) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    while (files.length > keep) {
      const oldest = files.shift();
      try { fs.unlinkSync(path.join(dir, oldest)); } catch (e) {}
    }
  }

  // ---- 工具 ----
  _serialize(map) { const o = {}; for (const k in map) o[k] = map[k].toString(); return o; }
  _deserialize(obj) { const o = {}; for (const k in obj) o[k] = BigInt(obj[k]); return o; }
  _big(v) {
    try {
      if (v === null || v === undefined) return 0n;
      return BigInt(String(v));
    } catch { return 0n; }
  }
  readable(uyuan) {
    const u = this._big(uyuan);
    const y = Number(u) / Number(ONE_YUAN);
    return y.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' YUAN';
  }
}

module.exports = { OriginChain, CONSTITUTION_ARTICLE_0, FOUNDATION_WALLET, CHAIN_ID, TOKEN_DECIMALS, ONE_YUAN, MIN_STAKE_UYUAN, MAX_VALIDATORS, TOTAL_SUPPLY_UYUAN };

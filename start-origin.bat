@echo off
REM ============================================================
REM start-origin.bat — 源·ORIGIN 不死网络 一键启动
REM 第1窗口: 种子节点 第七舰队 :3001 (P2P 26656)
REM 第2窗口: 轻节点 深空观测站 :3002 (P2P 26657)
REM 量子总督 · 2026-08-12 重建
REM ============================================================

chcp 65001 >nul
cd /d "%~dp0"

echo [ORIGIN] 启动种子节点 第七舰队 :3001...
start "ORIGIN-Seed-第七舰队" cmd /k "node node.js 3001 26656 seed"

timeout /t 2 /nobreak >nul

echo [ORIGIN] 启动轻节点 深空观测站 :3002...
start "ORIGIN-Light-深空观测站" cmd /k "node node.js 3002 26657 light"

echo.
echo ============================================
echo  源·ORIGIN 不死网络 已启动
echo  种子:   http://localhost:3001  (P2P ws:26656)
echo  轻节点: http://localhost:3002  (P2P ws:26657)
echo ============================================
echo.
echo  RPC端点: /status /chain /validators /block /balance/:addr /supply /snapshots
pause

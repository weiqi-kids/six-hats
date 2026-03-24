#!/bin/bash
# 部署腳本 - 在主機上執行

set -e

cd /root/six-hats

echo "📥 拉取最新程式碼..."
git pull origin main

echo "📦 安裝依賴..."
pnpm install --frozen-lockfile

echo "🔨 建置前端..."
pnpm run build:web

echo "🔄 重啟服務..."
pm2 restart six-hats-api || pm2 start ecosystem.config.cjs

echo "💾 儲存 PM2 狀態..."
pm2 save

echo "✅ 部署完成！"
pm2 status

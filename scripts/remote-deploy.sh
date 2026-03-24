#!/bin/bash
# 遠端部署 - 在本機執行，透過 SSH 部署到主機

set -e

HOST="community"
REMOTE_PATH="/root/six-hats"

echo "🚀 開始遠端部署到 $HOST..."

ssh $HOST "cd $REMOTE_PATH && bash scripts/deploy.sh"

echo ""
echo "🌐 部署完成！訪問 https://6hats.ai.weiqi.kids"

#!/bin/sh
# 把仓库里的 skill 同步到本机「已安装」的 skill 目录。
#
# 为什么需要这一步：这个 skill 有两份。
#   · .agents/skills/ace-racer-update/  —— 跟着仓库走，进 git，多设备共享
#   · /skills/ace-racer-update/         —— agent 实际加载的那份
# 只改仓库那份，agent 读到的还是旧的。2026-10-06 就踩过一次：已装版停在 8 月 29 日，
# 落后 268 行，10 月 5 日那轮工作流重写根本没被 agent 看到。
#
# 用法：改完 SKILL.md 就跑一下
#   sh scripts/sync-skill.sh
#
# 换设备时如果 /skills 不在这个位置，用环境变量指过去：
#   SKILLS_DIR=/path/to/skills sh scripts/sync-skill.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/.agents/skills/ace-racer-update"
DST="${SKILLS_DIR:-/skills}/ace-racer-update"

if [ ! -f "$SRC/SKILL.md" ]; then
    echo "✗ 找不到源文件：$SRC/SKILL.md" >&2
    exit 1
fi

mkdir -p "$DST"
cp -r "$SRC/." "$DST/"

if diff -q "$SRC/SKILL.md" "$DST/SKILL.md" > /dev/null 2>&1; then
    echo "✓ 已同步：$SRC/  →  $DST/"
    echo "  仓库版 $(wc -c < "$SRC/SKILL.md") 字节，两处一致"
else
    echo "✗ 同步后校验不一致，请检查 $DST" >&2
    exit 1
fi

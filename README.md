# Ace-Racer-Calc
王牌竞速大招能量计算器
# 王牌竞速 · 大招能量精密计算器

> **Ace Racer Ultimate Energy Calculator** — 由 Vanem 设定交互逻辑与计算公式，AI 辅助开发。

![](https://i0.hdslb.com/bfs/openplatform/98b8c12bc7177aa56b9b3c75b3a5b1cda3fad086.jpg)
## 📖 项目简介
面向网易手游《王牌竞速》的高精度能量运算工具，双轨并行测算：
1. **首发一大（一气首大）**：判断开局是否能直接满能量释放首个大招；
2. **后续大招无限循环**：判断大招持续期间能否自洽充能、实现无限连发。

## ✨ 核心功能
- 6 种氮气规格等比同步换算
- 智能芯片联动面板（先机 / 汇能自动反算）
- 七大赋能系统矩阵（最多同时激活 2 个）
- 对手反制干扰模拟（0% ~ 18%）
- 实时双轨测算引擎（首发 + 循环）

## 🚀 使用方法
>本地使用
1. 下载 HTML 文件，选择在浏览器打开
2. 填写车辆、芯片、赋能配置
3. 查看首发大招与后续循环的实时测算结果
4. 根据 ❌/✅ 提示调整配装
>云端使用
- 直接访问我的演示网站：[王牌竞速 - 大招能量计算器](https://www.aceracercalc.top/)

## 🔄 更新工作流

### 添加新车（有 single-{ID} 数据包时）
```bash
node scripts/update.mjs [车ID...]
# 不加ID自动扫描所有 single-* 目录
# 加ID只处理指定车辆，如: node scripts/update.mjs 10037 12099
```
自动完成：复制数据 → 重建数据库 → 上传图片到 B站 CDN → 更新 CDN 引用

### 只上传新车图片（数据已就绪）
```bash
node scripts/upload-bili.mjs
```
自动跳过已上传的图片，只传新图。

### B站 Cookie 维护
Cookie 保存在 `.agent_tmp/bili-cookies.json`（不受版本控制）。
上传脚本 `scripts/upload-bili.mjs` 内含硬编码 cookie（已在 `.gitignore`）。
如需更新 cookie，修改该文件顶部 `SESSDATA` / `BILI_JCT` 两行即可。

### 完整推送流程
```bash
node scripts/update.mjs    # 完成全部更新步骤
git add -A
git commit -m "feat: ..."
git push                   # 自动触发 Vercel 部署
```

## ⚠️ 声明
本项目为个人公益制作，由 Vanem 独立设定全部交互逻辑与计算公式，AI 辅助完成代码开发。
严禁任何形式的倒卖、付费传播或商业利用。

## 👍 支持作者
如果觉得这个工具做的还不错的话，可以通过微信赞赏码来支持我，您的赞赏就是我更新的最大动力，感谢🌹

![](https://i0.hdslb.com/bfs/openplatform/07d46fa9619f7ae4fa275da96d3c34d78e552624.png)

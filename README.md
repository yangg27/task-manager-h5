# 任务管家（Task Manager H5）

一个适合在手机上操作的本地任务管理 H5 应用。支持任务录入、日历视图、进展跟踪、子任务、任务模板、邮件报告、数据导出与浏览器通知提醒。所有数据存储在浏览器本地（IndexedDB），无需服务器，保护隐私。

---

## 功能特性

| 模块 | 功能 |
|------|------|
| 账号系统 | 邮箱/手机号注册、登录、修改密码、头像上传 |
| 日历视图 | 月份切换、任务密度颜色标记、节假日淡显、点击日期查看任务 |
| 任务管理 | 增删改查、分类、优先级、标签、搜索、筛选、排序 |
| 任务详情 | 编辑内容/截止时间、更新进展、上传图片/文件/拍照、子任务 checklist |
| 重复任务 | 支持每天/每周/每月/每年自动生成 |
| 任务模板 | 保存常用任务为模板，快速创建 |
| 年度规划 | 粘贴年度计划文本，自动按月份拆解为任务 |
| 邮件报告 | 一键生成「本月已完成 + 本周应完成」邮件内容 |
| 通知提醒 | 浏览器本地通知，到期前提醒 |
| 数据安全 | 数据导出 JSON 备份、导入恢复、回收站 |

---

## 快速开始（Windows 10）

### 方式一：一键启动（推荐）

1. 下载本项目并解压到任意目录，例如 `D:\任务管家`
2. 双击运行 `start.bat`
3. 浏览器会自动打开 `http://localhost:8080`

> 需要 Windows 10 已安装 Python 3 或 Node.js。如果没有，脚本会提示下载地址。

### 方式二：Python 命令行

```bash
cd 任务管家
python start.py
```

### 方式三：Node.js

```bash
cd 任务管家
node server.js
```

### 方式四：直接打开（部分功能受限）

双击 `index.html` 用浏览器打开。此方法下 Service Worker 和通知功能可能受限，建议优先使用本地服务器方式。

---

## 项目结构

```
task-manager-h5/
├── index.html          # 应用入口
├── app.js              # 主界面逻辑
├── tasks.js            # 任务业务逻辑
├── auth.js             # 认证逻辑
├── db.js               # IndexedDB 封装
├── calendar.js         # 日历与节假日
├── email-report.js     # 邮件报告生成
├── notifications.js    # 浏览器通知
├── utils.js            # 工具函数
├── style.css           # 样式
├── sw.js               # Service Worker（离线缓存）
├── manifest.json       # PWA 配置
├── start.py            # Python 本地服务器
├── start.bat           # Windows 一键启动
├── server.js           # Node.js 本地服务器
├── test-e2e.js         # 自动化复测脚本
├── icons/              # 应用图标
├── README.md           # 项目说明
├── DEPLOY.md           # 部署教程
├── USER_MANUAL.md      # 用户操作手册
└── LICENSE             # MIT 协议
```

---

## 浏览器支持

- Google Chrome / Microsoft Edge（推荐）
- Firefox、Safari 等现代浏览器
- 手机浏览器可添加至主屏幕，像原生 App 一样使用

---

## 数据说明

- 所有数据保存在浏览器 `IndexedDB` 中
- 数据不会上传到任何服务器
- 换电脑、清浏览器数据、卸载浏览器会导致数据丢失
- 建议定期使用「我的 → 数据管理 → 导出备份」保存 JSON 文件

---

## 开源协议

[MIT](LICENSE)

---

## 复测记录

- 复测时间：2026-10-17
- 复测工具：Playwright + Microsoft Edge
- 测试项：页面加载、注册登录、创建任务、日历标记、列表查看、搜索、删除任务、统计页、我的页
- 修复内容：导入备份所有权校验、头像 dataUrl 前缀校验、模板 ID 转义、重复任务生成闭环控制
- 结果：**9 项全部通过，0 失败**

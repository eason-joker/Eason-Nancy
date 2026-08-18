# ArtTrans Translation Workbench

面向英文/德文学术文本的 AI 翻译与人工校订系统。这个版本把原来的单文件前端应用拆成了前后端 Web 系统：

- 前端：React + Vite，负责登录、文本翻译工作台、术语核对、整段校订和译文导出。
- 后端：Express，负责用户管理、按用户隔离的术语表维护、批量导入、从译文 token 入库，以及 Gemini API 代理调用。
- 存储：开发版使用 `server/data/db.json` 持久化，便于本地运行和后续替换数据库。

## 快速开始

```bash
npm install
copy .env.example .env
npm run dev
```

打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)。

演示账户：

```text
demo@arttrans.local
demo123456
```

## LLM 配置

API Key 只放在后端 `.env`，不要放到浏览器端。使用 Gemini：

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=你的 key
```

使用 OpenAI / ChatGPT API：

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=你的 key
OPENAI_MODEL=gpt-4o-mini
```

没有配置云端 Key 时，后端会使用本地演示翻译逻辑，方便验证术语标注和校订流程。

## 术语表导入格式

支持 `.xlsx`、`.xls`、`.csv`。第一张表会被解析，列名支持：

```text
原文 / source
语种 / lang / Language
专词类型 / category / Type
建议候选中文译名 / 中文译名 / translations
学术释义 / 释义 / note
学术出处 / 出处 / provenance
```

多个译名可用 `;`、`，`、`、`、`,` 分隔。

## 主要 API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/glossary`
- `POST /api/glossary`
- `PUT /api/glossary/:id`
- `DELETE /api/glossary/:id`
- `POST /api/glossary/import`
- `POST /api/glossary/from-token`
- `POST /api/translate`

生产部署时可以先运行 `npm run build`，再用 `npm start` 启动后端；后端会托管构建后的前端静态文件。

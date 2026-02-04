# cf_ai_insightgen

A Cloudflare AI application that demonstrates the use of Workers, D1, and Workers AI.

## Features
- **Workers AI**: Uses Llama 3.3 (70B) for high-quality, intelligent summaries.
- **Worker Coordination**: Orchestrates the AI generation and database saving steps directly in the backend.
- **D1 Database**: Persists user queries and AI responses.
- **Frontend**: A clean, responsive UI served directly from the Worker.

## How to Run
1. Install dependencies: `npm install`
2. Create D1 database: `npx wrangler d1 create insight-db`
3. Update `wrangler.jsonc` with your new Database ID.
4. Apply schema: `npx wrangler d1 execute insight-db --local --file=./schema.sql`
5. Run locally: `npx wrangler dev`
6. Deploy: `npx wrangler deploy`
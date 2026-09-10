# AgendAI Backend

API Bun/Hono para validar Firebase App Check, aplicar limites por IP e token em Redis, transcrever áudio e devolver `AlarmDraft[]` estruturados. Ela não persiste áudios, transcrições ou alarmes.

## Executar localmente

1. Copie `.env.example` para `.env` e preencha os segredos.
2. Instale dependências com `bun install`.
3. Rode `bun run dev`.

Use `bun run check` e `bun test` antes de publicar. Os testes usam mocks locais; não chamam Firebase, Redis nem OpenAI.

## Endpoints

- `POST /register-auth` com `X-Firebase-AppCheck`: possui limite por IP, verifica se o token pertence a um `FIREBASE_ALLOWED_APP_IDS` autorizado e guarda apenas seu SHA-256 em Redis até a expiração.
- `POST /parse` com JSON `{ text, context }`: requer token válido e registrado; retorna sempre `AlarmDraft[]`.
- `POST /transcribe` com `multipart/form-data`: requer `audio`, `currentDateTime`, `timezone` e `locale`; verifica MIME, assinatura, tamanho e duração antes da transcrição e retorna `AlarmDraft[]`.

O `REDIS_URL` é o endpoint HTTPS REST do Redis/Upstash e `REDIS_TOKEN` é seu bearer token. Não use uma URL `redis://` nessa implementação. Para acesso via browser, configure `CORS_ALLOWED_ORIGINS` com as origens do frontend, separadas por vírgula.

## Vercel

Faça o deploy com `backend` como Root Directory e cadastre todas as variáveis de `.env.example` no painel. `vercel.json` usa Bun 1.x e reescreve as três rotas para a função Hono em `api/index.ts`.

Na Vercel, Functions aceitam no máximo 4,5 MB por request. Por isso, `MAX_AUDIO_SIZE_BYTES` é limitado a 4.000.000 bytes e uploads sem `Content-Length` são rejeitados antes do parse multipart. Configure `FIREBASE_ALLOWED_APP_IDS` com os IDs dos apps Firebase que podem chamar esta API e mantenha `UPSTREAM_TIMEOUT_MS` abaixo do timeout da Function.

## Teste sem validação Firebase por requisição

Defina `APP_AUTH_TEST_TOKEN` no backend e envie exatamente esse valor no cabeçalho `X-Firebase-AppCheck`. Esse token libera `/register-auth`, `/parse` e `/transcribe` sem verificar aquela requisição no Firebase nem exigir o registro do token em Redis; os limites por IP e por token continuam ativos. As variáveis `FIREBASE_*` e o verifier continuam obrigatórios, pois o Firebase permanece o fluxo normal de autenticação. Não exponha esse token em um build público ou em produção: ele é apenas um atalho temporário para desenvolvimento e testes.

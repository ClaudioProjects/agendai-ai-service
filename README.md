# AgendAI Backend

API Bun/Hono para validar Firebase App Check, aplicar limites por IP e token em Redis e devolver `AlarmDraft[]` extraídos de texto ou áudio. Ela não persiste áudios ou alarmes.

## Executar localmente

1. Copie `.env.example` para `.env` e preencha os segredos.
2. Instale dependências com `bun install`.
3. Rode `bun run dev`.

Use `bun run check` e `bun test` antes de publicar. Os testes usam mocks locais; não chamam Firebase, Redis nem OpenAI.

## Endpoints

- `POST /register-auth` com `X-Firebase-AppCheck`: possui limite por IP, verifica se o token pertence a um `FIREBASE_ALLOWED_APP_IDS` autorizado e guarda apenas seu SHA-256 em Redis até a expiração.
- `POST /parse` com JSON `{ text, context }`: requer token válido e registrado; retorna sempre `AlarmDraft[]`.
- `POST /transcribe` com `multipart/form-data`: requer `audio` em WAV ou MP3, `currentDateTime`, `timezone` e `locale`; verifica MIME, assinatura, tamanho e duração antes de interpretar o áudio e retorna `AlarmDraft[]`. O nome da rota foi preservado para compatibilidade com o cliente.

Nos dois endpoints, quando o parser retorna um lembrete com `date: null`, o backend preenche a data atual em `YYYY-MM-DD`, calculada a partir de `context.currentDateTime` no fuso `context.timezone`. Datas identificadas pelo parser são preservadas.

O áudio e o contexto de data são enviados juntos em **uma única chamada** a Chat Completions com `OPENAI_AUDIO_MODEL=gpt-audio-1.5`. O modelo retorna os alarmes por function calling; o backend valida os argumentos com Zod. Não há chamada de transcrição nem uma segunda chamada ao parser de texto. Áudio sem intenção de lembrete (ou sem fala inteligível) retorna `[]`; respostas inválidas retornam `INVALID_AI_RESPONSE`, sem repetir a chamada.

O frontend converte as gravações WebM/MP4/Ogg/AAC para WAV mono de 16 kHz antes do envio, usando Web Audio. Outros clientes devem enviar WAV ou MP3. O limite de tamanho também se aplica ao WAV convertido: com o padrão de 4 MB, cabem aproximadamente dois minutos nesse formato.

Substitua `OPENAI_TRANSCRIPTION_MODEL` por `OPENAI_AUDIO_MODEL` no ambiente local e na hospedagem; na ausência da nova variável, o padrão é `gpt-audio-1.5`. O endpoint de texto continua usando `OPENAI_PARSE_MODEL`.

O `REDIS_URL` é o endpoint HTTPS REST do Redis/Upstash e `REDIS_TOKEN` é seu bearer token. Não use uma URL `redis://` nessa implementação. Para acesso via browser, configure `CORS_ALLOWED_ORIGINS` com as origens do frontend, separadas por vírgula.

## Vercel

Faça o deploy com `backend` como Root Directory e cadastre todas as variáveis de `.env.example` no painel. `vercel.json` usa Bun 1.x e reescreve as três rotas para a função Hono em `api/index.ts`.

Na Vercel, Functions aceitam no máximo 4,5 MB por request. Por isso, `MAX_AUDIO_SIZE_BYTES` é limitado a 4.000.000 bytes e uploads sem `Content-Length` são rejeitados antes do parse multipart. Configure `FIREBASE_ALLOWED_APP_IDS` com os IDs dos apps Firebase que podem chamar esta API e mantenha `UPSTREAM_TIMEOUT_MS` abaixo do timeout da Function.

## Teste sem validação Firebase por requisição

Defina `APP_AUTH_TEST_TOKEN` no backend e envie exatamente esse valor no cabeçalho `X-Firebase-AppCheck`. Esse token libera `/register-auth`, `/parse` e `/transcribe` sem verificar aquela requisição no Firebase nem exigir o registro do token em Redis; os limites por IP e por token continuam ativos. As variáveis `FIREBASE_*` e o verifier continuam obrigatórios, pois o Firebase permanece o fluxo normal de autenticação. Não exponha esse token em um build público ou em produção: ele é apenas um atalho temporário para desenvolvimento e testes.

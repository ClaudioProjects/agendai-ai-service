## Runtime e ferramentas

- O runtime padrão do projeto é o **Bun**.
- Usar `bun`, `bunx` e os scripts definidos no `package.json` como primeira opção.
- Não substituir o Bun por Node.js/npm sem autorização explícita.
- Solicitar autorização explícita antes de instalar qualquer pacote ou dependência.

## Arquitetura do backend

- Manter uma relação **1:1 entre router e controller**: cada rota deve ter um arquivo próprio em `src/routers` e um controller correspondente, com o mesmo nome de arquivo, em `src/controllers`.
- O router registra a rota e seus middlewares, valida os headers, lê e valida o payload HTTP e adapta os dados para a entrada do controller.
- O controller deve ser injetado no router. Routers não instanciam controllers nem acessam use-cases diretamente.
- O router retorna a resposta HTTP a partir do resultado do controller, sem construir resultados de sucesso de negócio por conta própria.
- Controllers recebem dados simples, orquestram os use-cases injetados e retornam o resultado em caso de sucesso. Em caso de falha, lançam ou propagam um erro.
- Controllers não devem importar Hono nem receber `Context`, `Request`, `Response`, `FormData` ou `File`. O contexto de data, timezone e locale é dado de domínio e pode fazer parte da entrada.
- Tratar os erros e convertê-los em respostas HTTP no `app.onError` central de `src/create-app.ts`; não capturar erros nos controllers para retornar respostas de falha.
- `src/index.ts` instancia e conecta providers, use-cases e controllers. `src/create-app.ts` recebe os controllers, configura middlewares globais e tratamento de erros e monta os routers.
- Pares atuais: `register-auth.ts` para `POST /register-auth`, `parse.ts` para `POST /parse` e `transcribe.ts` para `POST /transcribe`.
- Ao alterar essas camadas, validar a injeção dos controllers, a preservação dos resultados, a propagação dos erros e o bloqueio de requisições inválidas antes de chamar use-cases.

## Formatação obrigatória

- Sempre executar o Prettier em todos os arquivos da pasta `/backend` antes de finalizar qualquer alteração:

```bash
bunx prettier --write .
```

- A execução deve acontecer mesmo quando a alteração envolver apenas um arquivo.
- Depois do Prettier, executar novamente as validações aplicáveis.

## Commits

- Trabalhar por feature ou correção.
- Cada feature ou correção concluída deve gerar um commit próprio.
- Evitar misturar mudanças não relacionadas.
- Padrão recomendado:

```text
feat: implement feature
chore: update tooling
fix: correct behavior
```

- Antes do commit, executar as validações disponíveis: typecheck, lint, testes e build, além de validar manualmente o fluxo alterado quando aplicável.
- Usar somente a autoria Git configurada pelo usuário.
- Nunca adicionar `Co-authored-by` para agente, IA, ChatGPT, OpenAI ou ferramenta de co-work.

## Runtime e ferramentas

- O runtime padrão do projeto é o **Bun**.
- Usar `bun`, `bunx` e os scripts definidos no `package.json` como primeira opção.
- Não substituir o Bun por Node.js/npm sem autorização explícita.
- Solicitar autorização explícita antes de instalar qualquer pacote ou dependência.

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

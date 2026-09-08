## Runtime e ferramentas

- O runtime padrão do projeto é o **Bun**.
- Usar `bun`, `bunx` e os scripts definidos no `package.json` como primeira opção.
- Não substituir o Bun por Node.js/npm sem autorização explícita.

## Formatação obrigatória

- Sempre executar o Prettier em todos os arquivos da pasta `/backend` antes de finalizar qualquer alteração:

```bash
bunx prettier --write .
```

- A execução deve acontecer mesmo quando a alteração envolver apenas um arquivo.
- Depois do Prettier, executar novamente as validações aplicáveis.

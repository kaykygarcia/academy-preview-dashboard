# Kayky Deployments

Dashboard para acompanhar ambientes temporários de pull requests do [academy-preview-api](https://github.com/kaykygarcia/academy-preview-api).

Exibe PRs abertos, commits, status dos GitHub Deployments e links para os previews no ECS Fargate. Inclui busca, filtros e atividade recente. Os dados são consultados diretamente da API do GitHub, sem banco de dados.

## Stack

- HTML, CSS e JavaScript
- Cloudflare Pages Functions
- GitHub REST API

## Desenvolvimento

Requer Node.js 20 ou superior.

```bash
npm run dev
```

A aplicação fica disponível em `http://127.0.0.1:4173`.

A variável opcional `GITHUB_TOKEN` permite consultas autenticadas à API do GitHub. O token deve ter apenas permissões de leitura de Pull Requests e Deployments. Credenciais não devem ser versionadas.

## Testes

```bash
npm run check
```

## Arquitetura

O navegador consome `/api/overview`. A Pages Function consulta pull requests e deployments do GitHub, consolida os resultados e devolve os dados usados pela interface. O token permanece no servidor.

O painel é somente leitura: não cria, atualiza nem remove recursos na AWS.

## Limitações

- O status exibido reflete o último deployment registrado no GitHub, não monitoramento contínuo da aplicação.
- As URLs dos previews podem mudar após novas implantações no ECS.
- O acesso aos previews depende das regras de rede configuradas no ambiente AWS.

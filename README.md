# Comitadus · Eventos institucionais

Sistema de gestão de eventos com React, Node.js e PostgreSQL.

## Requisitos

- Node.js 22.21 ou superior na série 22, com npm 10 ou superior.
- Internet para a primeira instalação.

Baixe ou clone o repositório e abra um terminal na pasta que contém `package.json`. Não é necessário instalar PostgreSQL ou Docker separadamente para seguir os passos abaixo.

## Primeira execução

**1. Instale as dependências:**

```sh
npm ci
```

**2. Crie o arquivo `.env` copiando `.env.example`.** No PowerShell:

```powershell
Copy-Item .env.example .env
```

No Prompt de Comando, use `copy .env.example .env`; no Linux/macOS, use `cp .env.example .env`. Se `.env` já existir, preserve o arquivo. Os valores do exemplo já estão configurados para o banco local.

**3. Gere o cliente do banco e inicie o PostgreSQL local:**

```sh
npm run db:generate
npm run db:local
```

Aguarde a mensagem **PostgreSQL local ativo** e mantenha esse terminal aberto. A porta 5432 precisa estar livre.

**4. Abra um segundo terminal na mesma pasta e execute, um comando por vez:**

```sh
npm run db:migrate
npm run dev
```

Só avance se o comando anterior concluir sem erro. Deixe esse terminal aberto: ele executa frontend e backend.

**5. Acesse [http://127.0.0.1:5173](http://127.0.0.1:5173).**

## Dados e acesso

Entre com uma conta já cadastrada. Novos usuários são cadastrados pela administração.

Os dados existentes permanecem no PostgreSQL local, em `.postgres/`. Não apague essa pasta. Baixar o projeto pelo GitHub em outra máquina não transfere seus dados: para isso, é necessário transferir e restaurar um backup do banco. Um banco novo começa vazio, inclusive sem usuários.

O comando `npm run db:seed` não cria mais registros fictícios. Exemplos só são carregados quando solicitados explicitamente com `npm run db:seed:demo`.

## Próximas execuções

No primeiro terminal:

```sh
npm run db:local
```

No segundo terminal:

```sh
npm run dev
```

Para encerrar, pressione **Ctrl+C** nos dois terminais. Os dados ficam salvos em `.postgres/`.

Se o PowerShell bloquear `npm.ps1`, substitua `npm` por `npm.cmd` nos comandos. Se uma porta estiver ocupada, encerre a execução anterior antes de iniciar novamente.

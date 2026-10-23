
# Comitadus — Sistema de Gestão de Eventos Institucionais

O **Comitadus** é uma plataforma web desenvolvida para centralizar, organizar e acompanhar a realização de eventos institucionais da **Univille — Campus São Bento do Sul**.

O sistema permite que a comunidade consulte a agenda pública de eventos, pesquise por títulos e temas, visualize a programação em formato de lista ou calendário e acesse informações detalhadas sobre cada evento.

Usuários autenticados podem criar solicitações de eventos, salvar rascunhos, editar informações, selecionar temas, cursos, ambientes e recursos disponíveis, além de acompanhar o andamento de cada solicitação.

A plataforma possui um fluxo de aprovação com os status:

- Rascunho;
- Pendente;
- Aprovado;
- Rejeitado;
- Cancelado.

Cada solicitação possui um histórico das ações realizadas e pode incluir justificativas em casos de rejeição ou cancelamento.

Administradores possuem recursos adicionais para:

- Analisar, aprovar ou rejeitar solicitações;
- Gerenciar usuários;
- Gerenciar cursos e coordenações;
- Cadastrar temas de eventos;
- Gerenciar ambientes e recursos disponíveis;
- Administrar centros de custo;
- Consultar relatórios;
- Filtrar informações por período, status, curso, ambiente e tema;
- Exportar dados em formato CSV.

A aplicação foi desenvolvida utilizando:

- React;
- TypeScript;
- Node.js;
- PostgreSQL.

O sistema também conta com autenticação de usuários, controle de permissões, validação de dados, proteção de rotas e uma interface responsiva e acessível.

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


## Apoio no desenvolvimento

Algumas etapas do desenvolvimento contaram com o auxílio do ChatGPT, utilizado como ferramenta complementar para resolução de dúvidas técnicas, sugestão de melhorias, revisão de código e elaboração da documentação. A implementação, validação e decisões finais foram realizadas pela equipe do projeto.

# Publicar na Vercel pelo GitHub, preservando os dados

A interface e a API serão executadas na Vercel. Os dados ficarão em um PostgreSQL online no Neon. O GitHub envia o código; o banco atual precisa ser copiado separadamente.

## 1. Crie o banco online

1. Entre em [Neon](https://console.neon.tech/) e crie um projeto, por exemplo `comitadus-eventos`.
2. Selecione **PostgreSQL 18** e a região **AWS US East / N. Virginia**. Mantenha as funções da Vercel na mesma região, **Washington, D.C. / iad1**.
3. Mantenha o banco de destino vazio. Não execute migrations ou seed antes da importação completa abaixo.
4. Em **Connect**, localize host, database, role e senha. Para a importação, desligue **Connection pooling**: o host direto não contém `-pooler`.

## 2. Copie o banco atual

Instale as ferramentas de linha de comando do **PostgreSQL 18** pelo [instalador oficial para Windows](https://www.postgresql.org/download/windows/). Precisaremos de `pg_dump.exe`, `pg_restore.exe` e `psql.exe`. Não é necessário instalar outro servidor local. Os comandos abaixo consideram a pasta padrão `C:\Program Files\PostgreSQL\18\bin`; ajuste se escolher outro local.

No terminal do VS Code, na raiz do projeto, mantenha o banco local ligado:

```powershell
npm.cmd run db:local
```

Se ele já estiver funcionando, use a execução existente. Pause `npm run dev` com Ctrl+C e evite alterações nos registros durante a cópia. Em outro terminal PowerShell:

```powershell
$pgTools = 'C:\Program Files\PostgreSQL\18\bin'
New-Item -ItemType Directory -Force '.postgres\backups' | Out-Null
& "$pgTools\pg_dump.exe" --host=127.0.0.1 --port=5432 --username=eventos --dbname=eventos --password --format=custom --no-owner --no-acl --file='.postgres\backups\para-vercel.dump'
```

Quando solicitado, informe a senha local definida em `.env`. Na configuração local original, ela é `eventos_local_demo`. Se o comando falhar, resolva o erro antes de continuar.

Substitua os três valores abaixo pelos dados do **banco vazio no Neon**, usando o host direto:

```powershell
$env:PGSSLMODE = 'require'
& "$pgTools\pg_restore.exe" --host='HOST_DIRETO_NEON' --port=5432 --username='ROLE_NEON' --dbname='DATABASE_NEON' --password --no-owner --no-acl --single-transaction --exit-on-error '.postgres\backups\para-vercel.dump'
Remove-Item Env:PGSSLMODE
```

Digite a senha do Neon quando solicitada. Só prossiga se terminar sem erros. A transação evita uma importação parcial em caso de falha. A cópia inclui tabelas, registros, usuários, senhas protegidas, histórico, regras do banco e histórico das migrations. Não execute `db:seed:demo`: os registros atuais já estarão no backup.

Confira as contagens no SQL Editor do Neon:

```sql
SELECT 'usuarios' AS tabela, COUNT(*) FROM "User"
UNION ALL SELECT 'eventos', COUNT(*) FROM "EventRequest"
UNION ALL SELECT 'historico', COUNT(*) FROM "RequestHistory";
```

Para comparar com a origem, execute a mesma consulta localmente:

```powershell
& "$pgTools\psql.exe" --host=127.0.0.1 --port=5432 --username=eventos --dbname=eventos --password
```

Cole a consulta SQL acima no terminal do `psql`. Compare os resultados e saia com `\q`.

O backup fica em `.postgres/backups/`, ignorado pelo Git. Guarde-o; não envie senhas, `.env` ou backups ao GitHub.

## 3. Envie a configuração para o GitHub

No **Controle de Código-Fonte** do VS Code, revise as alterações, faça um commit e use **Sincronizar / Push** para o repositório conectado à Vercel.

A publicação precisa incluir `api/index.ts`, `vercel.json`, `package.json`, `package-lock.json` e `tsconfig.json`, além do restante do código. A raiz do repositório deve conter `package.json`.

## 4. Importe o repositório na Vercel

Como o GitHub já está conectado, na [Vercel](https://vercel.com/dashboard) escolha **Add New → Project → Import Git Repository → Import**, no seu repositório. Se o projeto já foi importado, abra-o e ajuste suas configurações.

| Configuração | Valor |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | Raiz do repositório (`./`), onde está `package.json` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | `22.x` |

O `vercel.json` já define instalação, build, saída e roteamento da API. Não selecione somente a pasta `frontend` como raiz.

## 5. Configure as variáveis de ambiente

Em **Environment Variables**, adicione para o ambiente **Production**:

| Nome | Valor |
| --- | --- |
| `DATABASE_URL` | URL do Neon, com **Connection pooling ligado**, SSL e credenciais do banco importado |
| `APP_ORIGIN` | Endereço final do site, por exemplo `https://comitadus-eventos.vercel.app`, sem barra no final |

Em **Connect** no Neon, escolha a conexão para Prisma, quando disponível, e copie a URL completa. Use a URL com `-pooler` para a aplicação. Acrescente `&connection_limit=1` se a URL já tiver `?` e esse parâmetro ainda não existir. Nunca use prefixo `VITE_` na variável do banco: ela pertence exclusivamente ao backend.

Não copie o `.env` local para a Vercel: ele aponta para `localhost` e define desenvolvimento. A Vercel executará a aplicação com `NODE_ENV=production`.

Clique em **Deploy**. Em **Settings → Domains**, confira o domínio real atribuído ao projeto. Se for diferente do valor de `APP_ORIGIN`, corrija a variável em **Settings → Environment Variables** e faça **Deployments → último deployment → Redeploy**. A alteração da variável só será aplicada no próximo deployment. Faça login pelo domínio configurado em `APP_ORIGIN`.

## 6. Verifique o site publicado

1. Abra `https://SEU-DOMINIO.vercel.app/api/health`: deve mostrar `{"ok":true}`.
2. Abra a página inicial e entre com uma conta que já existia no banco local.
3. Confira os registros migrados. Crie ou edite um registro e atualize a página para verificar a persistência.
4. Abra o site em outro computador e confira o mesmo registro.
5. Atualize diretamente a página `/login` para conferir o roteamento.

Depois da migração, o site publicado usa o Neon. O projeto local continua com o banco local enquanto seu `.env` apontar para `localhost`: alterações locais não serão sincronizadas automaticamente com o Neon.

Novos pushes na branch de produção configurada na Vercel gerarão novos deployments. Não execute seed automaticamente no build. Se uma mudança futura criar migrations, aplique-as com `prisma migrate deploy` contra a conexão direta do banco online antes de publicar o código que depende delas; preserve o `.env` local.

## Erros comuns

- **Origem não autorizada:** `APP_ORIGIN` deve ser exatamente a origem da URL utilizada, com `https://` e sem barra final. Corrija e faça Redeploy. URLs de Preview e domínios alternativos precisam de configuração própria.
- **API retorna HTML / resposta inválida:** confira se `vercel.json` e `api/index.ts` chegaram ao GitHub e se Root Directory está na raiz.
- **Erro de conexão ou banco vazio:** confira `DATABASE_URL`, SSL, destino da importação e logs em **Logs / Functions** na Vercel.
- **Login falha somente online:** confirme o sucesso da importação e use a conta já cadastrada, pelo domínio de produção configurado.

Documentação: [Vite e funções na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [migração PostgreSQL para Neon](https://neon.com/docs/import/migrate-from-postgres), [Prisma com Neon](https://neon.com/docs/guides/prisma).

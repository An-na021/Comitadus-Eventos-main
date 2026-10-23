# Registro de validação — 23/10/2026

- Migração versionada aplicada com sucesso em PostgreSQL local real, nos bancos `eventos` e `eventos_test`.
- Seed fictício executado: três usuários, três cursos e centros de custo, quatro temas e ambientes, seis recursos e oito eventos.
- **44 testes automatizados aprovados**: sete de domínio, 31 de integração com PostgreSQL e seis de tratamento de respostas da API.
- Login: cliente Prisma regenerado após detectar a instalação sem os modelos do projeto; inicialização, testes e build agora verificam o cliente antes de gerá-lo. Banco e API responderam corretamente, com login HTTP 200 nas três contas fictícias. Falhas de rede, proxy vazio, resposta HTML, limite de tentativas e credenciais incorretas têm mensagens específicas.
- Exclusão de solicitantes: administrador pode excluir contas ativas ou inativas sem vínculos; as sessões são removidas. Visitantes e solicitantes não podem excluir usuários. Contas administrativas e solicitantes com solicitações ou histórico vinculados são preservados; nesses casos, a interface orienta a desativação.
- Testes verificam perfis, autoria, rascunhos incompletos, envio, restrições de edição, aprovação, rejeição, reenvio, cancelamentos, publicação, recursos por ambiente, centro de custo, CRUDs, CSV, inativação, CSRF e integridade referencial.
- Concorrência: duas aprovações simultâneas para o mesmo ambiente/intervalo retornaram uma aprovação e um conflito; não houve reserva dupla.
- Defesa no banco: tentativa de forçar sobreposição diretamente pelo Prisma foi rejeitada pela restrição PostgreSQL.
- Persistência: teste adicional encerrou a API, iniciou um novo processo e recuperou registro e sessão pelo HTTP. Os registros de teste foram removidos ao final.
- Build de produção e verificação TypeScript concluídos com sucesso.
- Auditoria de dependências: zero vulnerabilidades no momento da validação.
- Navegador: agenda pública com três aprovados, login administrativo, indicadores, formulário completo e relatórios conectados à API foram conferidos.

## Reproduzir

Com PostgreSQL ativo, `.env` configurado e `eventos_test` criado:

```powershell
npm test
npm run build
npm run test:restart
npm audit
```

O fluxo completo de reprodução e as contas fictícias estão no README. Docker Compose foi preparado; a execução e os testes nesta máquina usaram o PostgreSQL do comando `npm run db:local`, pois o serviço Docker não estava ativo. Não houve publicação externa ou envio para GitHub. A conferência de navegador não substitui uma revisão manual de todas as combinações de filtros e tamanhos de tela.

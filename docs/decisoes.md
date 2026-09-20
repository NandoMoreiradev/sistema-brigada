# Decisões do projeto — Escola de Treinamento de Brigada e Segurança

> Nome do projeto/produto: **Ignis**. Base de código de referência: `maskotCrmEdu` (CRM/plataforma para escolas, NestJS + Prisma + React).

## Contexto

Plataforma para uma escola de treinamento de brigada de incêndio e cursos de segurança (turmas, instrutores, alunos, eventos, certificados, crachás digitais), reaproveitando a stack e módulos maduros do Maskot Edu (auth, multiunidade/permissões, agenda, storage, vídeo-aulas), descartando o que é específico de CRM comercial (WhatsApp/Instagram, funil de vendas, chatbot, marketing).

## Estado de implementação (atualizado em 2026-09-02)

Codificação iniciada e em andamento. Módulos completos (backend + frontend, validados por typecheck/build/boot):

- ✅ Fundação — auth (JWT/refresh/2FA), multi-tenant, storage (R2), deploy Railway
- ✅ Organizações (tenant) — CRUD completo, só SUPER_ADMIN
- ✅ Pessoas (`User`+`StudentProfile`) — CRUD completo
- ✅ Turmas — matrícula, presença, diário de aula, vídeo-aulas com progresso
- ✅ Certificado/crachá digital — emissão automática, PDF+QR, personalização por academia, `/public/badge/:token`
- ✅ Equipe (staff) — promoção manual, certificação externa
- ✅ Eventos polimórficos — assembleia/congresso/atuação de brigada/reunião, escala de staff, relatório de ocorrência, presença de reunião, **Google Meet automático** (pendência do mapeamento de reaproveitamento abaixo, já resolvida — inclui a tela `/settings` pra conectar a conta Google, sem a qual ninguém conseguia ativar isso, 2026-09-17); `DesignationsService.create` bloqueia escalar staff sem qualificação válida (decisão 19, completa em 2026-09-17)
- ✅ Notificações reais — certificado emitido/vencendo (job diário + e-mail), designação, matrícula confirmada, sino no frontend
- ✅ E-mail transacional completo (2026-09-18) — templates no banco (padrão global + override por academia), Resend por-academia com fallback pra conta global da plataforma, construtor visual drag-and-drop (portado do maskotCrmEdu) e criação de academia já define o ORG_ADMIN no mesmo formulário, que recebe e-mail de boas-vindas com link de ativação. Ver seção própria abaixo.
- ✅ Permissões granulares — **Fase 1**: catálogo de permissões + cargos (`RoleAssignment`) configuráveis por organização, tela `/roles` (ver decisões 22-24)
- ✅ Permissões — **Fase 2** (backend, 2026-09-17): `userHasPermission` extraído de `PermissionsGuard` para reuso em services; `AuthService.getProfile` devolve `studentProfile`/`staffMember`/`instructorCourseIds`; endpoints `GET /me/courses`, `/me/enrollments`, `/me/designations`, `/me/certificates`; checagem de posse adicionada em `CourseLessonsService` (create/update de aula), `ClassSessionsService` (diário/presença) e `DesignationsService.updateStatus` — só quem tem a permissão administrativa do módulo (`courses:manage`/`events:manage`) OU é o dono do dado (instrutor da turma, staff da própria designação) passa
- ✅ Permissões — **Fase 3** (2026-09-17): listagem completa de Turmas/Equipe/Alunos/Certificados agora exige a permissão do módulo (`courses:manage`/`staff:manage`/`people:manage`/`certificates:manage`) tanto no backend (`GET` das listas + posse no detalhe de turma/certificado) quanto no frontend (`PermissionRoute`, nav condicional em `MainLayout`); quem não tem a permissão usa o recorte pessoal em `/my-courses`, `/my-certificates`, `/my-designations`; `/dashboard` deixou de ser placeholder — agora é "role-aware" (cards condicionais por papel acumulado: aluno/instrutor/staff/admin). **Eventos ficou de fora dessa restrição de propósito** — reuniões/assembleias são abertas a toda a organização por design (`meetings.service.ts`: presença é lista aberta, sem roster fixo), então `/events` continua acessível a qualquer autenticado.

Pendente:

- ⏸️ App mobile (decisão 12) — **adiado deliberadamente para uma fase futura** (2026-09-17), não é próximo passo do MVP web

## Validação end-to-end (2026-09-17)

Primeira vez que o sistema rodou contra um Postgres real (ambiente local: Postgres + backend + frontend + seed do Super Admin), em vez de só typecheck/build. Criada uma academia de teste inteira via API (org, org admin, instrutor, 2 alunos, 3 staff, turma com módulo/aula/sessão, evento de atuação, reunião, designação) e testado por papel (SUPER_ADMIN, ORG_ADMIN, instrutor, aluno, staff, pessoa sem vínculo) com 31 checagens automatizadas de permissão/posse (100% passando) + inspeção visual via Playwright/Chromium das telas de cada papel. Bugs reais encontrados e corrigidos:

1. **Onboarding de academia nova travava** — `prisma/seed.ts` criava o SUPER_ADMIN sem `isSuperAdminRoot: true`; sem isso, `PermissionsGuard` bloqueia qualquer rota com `@RequirePermission`, incluindo `POST /users` — ou seja, o Super Admin seedado criava a `Organization` mas não conseguia criar o primeiro `ORG_ADMIN` dela (quebrava a decisão 5 na prática). Corrigido: seed agora marca `isSuperAdminRoot: true` no create e no update (idempotente).
2. **Notificação de certificado levava a uma página sem acesso** — `link: '/certificates'` nas notificações de "certificado emitido" e "certificado vencendo" (recebidas pelo próprio aluno) apontava para a lista completa, que a Fase 3 restringiu a `certificates:manage`. Corrigido para `/my-certificates`.
3. **Toasts de "sem permissão" disparando sozinhos ao abrir a página, sem o usuário clicar em nada** — `CourseDetail.tsx`, `EventDetail.tsx`, `Courses.tsx` e `Staff.tsx` buscavam listas auxiliares (`GET /users`, `GET /staff`) sem checar se o usuário tinha a permissão daquela lista especificamente, mesmo a página em si sendo acessível a um papel diferente (ex.: instrutor abre a própria turma — permitido — mas a página também tentava buscar a lista completa de pessoas para o dropdown de matrícula — `people:manage`, que o instrutor não tem). Corrigido com `enabled: hasPermission(...)` nas queries afetadas, escondendo também os botões/controles que dependem delas (e, no caso da tabela de designações do evento, o dropdown de alterar status só aparece editável para quem administra ou é o dono daquela designação específica).

4. **Presença de reunião só funcionava pra quem tinha `people:manage`** (limitação apontada acima, resolvida no mesmo dia): criado `GET /users/roster` — endpoint enxuto (só `id`+`nome`, sem e-mail/telefone/cargo) sem `@RequirePermission`, aberto a qualquer autenticado da organização. `EventDetail.tsx` (aba Presença de reunião) passa a usar esse roster em vez de `GET /users`, e o botão "Registrar presença" volta a aparecer pra todo mundo, como o backend sempre permitiu.

### Validação de fluxo aluno/instrutor com interação real (2026-09-17, mesmo dia)

Além das checagens por API, testado com cliques/preenchimento de formulário de verdade via Playwright (não só navegação): instrutor cria aula em vídeo pela UI (modal "Nova aula" → aparece na lista), aluno marca/desmarca aula como assistida pelo botão de progresso (alterna nos dois sentidos), instrutor sem `people:manage` abre a aba Presença de uma reunião, vê as 8 pessoas da organização no seletor (via `/users/roster`) e registra presença com sucesso ("Presença registrada."). Nenhum toast de erro inesperado em nenhum dos três fluxos.

## Dois bugs de deploy em cadeia: `@nestjs/schedule` ESM e `crypto` global ausente no Node 18 (2026-09-18)

Deploy no Railway crash-loopava com `Error [ERR_REQUIRE_ESM]: require() of ES Module /app/node_modules/@nestjs/schedule/dist/index.js from /app/dist/app.module.js not supported` — nunca detectado localmente porque `npm run build`/`tsc --noEmit` não executam o código, só compilam. `@nestjs/schedule@12.x` é ESM puro (`"type": "module"`), mas o projeto compila para CommonJS (`nest build -b swc`). Rebaixado para `@nestjs/schedule@^6.1.3` (última major ainda CJS, compatível com `@nestjs/core ^11`, API idêntica — só usamos `@Cron`/`ScheduleModule.forRoot()`).

Corrigido esse, apareceu um segundo bug em cadeia: `ReferenceError: crypto is not defined` em `scheduler.orchestrator.js` (`@nestjs/schedule` chama `crypto.randomUUID()` do jeito antigo do Node, assumindo `globalThis.crypto`). Causa raiz: o Railway estava rodando **Node 18.20.5**, e `globalThis.crypto` só é global sem flag a partir do Node 19/20 — o `package.json` do backend nunca tinha um `engines.node`, então o Nixpacks escolheu a versão default dele (18.x) em vez de uma mais nova. Corrigido fixando `"engines": { "node": ">=20.9.0" }`. As duas falhas têm a mesma causa de fundo (ambiente de produção rodando um Node mais antigo que o usado em dev/validação local) — por isso passaram batido no `build`/`typecheck`, que não executam o bundle. Validado subindo o backend de verdade com os binários `node20`/`node22` locais (`NODE_ENV=production node dist/main.js`), não só compilando — mesmo cenário que quebrava no Railway nos dois casos.

## Duas lacunas fechadas: conexão Google Calendar e critérios de certificado (2026-09-17)

Duas funcionalidades que já estavam prontas no backend/schema mas nunca tinham UI, encontradas ao revisar "o que falta" depois da validação:

1. **Conexão com o Google Calendar nunca tinha um botão em lugar nenhum.** O fluxo OAuth inteiro já existia no backend (`GET /user-integrations/google/auth`, `/status`, `/callback`, `DELETE .../google`), mas sem nenhuma tela pra clicar em "Conectar", ninguém nunca conectava a conta — o "Google Meet automático" (✅ na lista acima) nunca ativava de verdade. Criada a página "Minha Conta" (`/settings`, nav item novo em `MainLayout`) com o status da conexão e os botões conectar/desconectar. O callback do backend, que redirecionava para `/calendar` (rota que nunca existiu no frontend), passa a redirecionar para `/settings`. Validado: status inicial, URL de autorização bem formada (client_id/redirect_uri/scopes corretos), e o ciclo completo conectado→desconectado simulando a integração direto no banco (não dá pra testar o handshake OAuth real neste ambiente sandbox, sem credenciais Google de verdade).
2. **Critérios de emissão de certificado não tinham campo nenhum na tela.** `minAttendancePercent`, `requireAllLessonsWatched`, `recyclingValidityMonths` e `recommendedRecyclingCourseId` (decisões 17 e 19) já existiam no schema/API, mas o formulário de criar turma não tinha nenhum desses campos — e não existia *nenhuma* forma de editar uma turma depois de criada. Toda turma criada até agora recebia os defaults do Prisma (75% de presença, todas as aulas obrigatórias, sem validade) sem chance de ajustar. Adicionados os 4 campos no formulário de criação (`Courses.tsx`) e um botão "Editar critérios" novo em `CourseDetail.tsx` (só visível a quem tem `courses:manage`) com os mesmos campos. Validado criando e editando turma de verdade pela UI.

## Cinco lacunas fechadas no módulo de Eventos (2026-09-17)

Encontradas ao mapear a dinâmica de criação de evento (`Event` polimórfico — decisão 2) contra o que a UI realmente expõe:

1. **Botão "Novo evento" sem gate de permissão.** `/events` é aberto a toda a organização por design (reunião/assembleia não é módulo administrativo), mas criar exige `events:manage`. Um instrutor/aluno via o botão e o modal completos e só descobria que não podia ao tomar um 403 do interceptor global. Corrigido escondendo o botão (`Events.tsx`) quando `!hasPermission(user, 'events:manage')` — mesmo padrão já usado em Courses/Staff.
2. **Aba Reunião editável por qualquer um.** `PATCH /events/:id/meeting` (pauta/ata/link do Meet) exige `events:manage`, mas `MeetingTab` mostrava o formulário e o botão "Salvar" pra qualquer um que abrisse a reunião — a aba de Designações ao lado já tinha esse gate, essa não. Corrigido: quem não tem a permissão vê pauta/ata em modo leitura; quem tem, vê o formulário editável de sempre.
3. **Não existia nenhuma forma de editar ou excluir um evento pela UI.** `eventsApi.update`/`.remove` (e `designationsApi.remove`/`occurrenceReportsApi.remove`) existiam no client e os endpoints funcionavam, mas nenhum botão os chamava — uma vez criado, um evento não podia ser reagendado, ter status alterado (agendado→andamento→concluído/cancelado) nem excluído, e uma designação/ocorrência registrada por engano não podia ser removida. Adicionados: modal "Editar evento" (título/local/data/status + público estimado/observações quando é operação) e botão "Excluir" no detalhe do evento; coluna de remover em Designações e Ocorrências — todos gated a `events:manage` (registrar ocorrência continua aberto a todos, só remover é restrito).
4. **Reagendar/excluir uma `REUNIAO` não sincronizava com o Google Calendar.** `GoogleCalendarService.updateEvent()`/`.deleteEvent()` já existiam e funcionavam, mas `EventsService.update()`/`.remove()` nunca os chamavam — um reagendamento pela UI (agora que existe, item 3) deixaria o convite do Google com o horário antigo. Corrigido: quando o evento é uma reunião com `googleEventId` e a mudança toca título/local/data, propaga pro Google Calendar do criador; exclusão remove o evento de lá também. Segue o mesmo padrão de `create()`: falha na chamada ao Google é só logada, nunca quebra a operação local.
5. **Status cru do enum na tela de detalhe.** `EventDetail.tsx` mostrava `Status: SCHEDULED` em vez do rótulo em português que `Events.tsx` já tinha. Corrigido reaproveitando (exportando) `STATUS_LABEL`/`STATUS_TONE` de `Events.tsx` como `Badge`, igual à lista.

Validado via Playwright com usuários reais (instrutor sem `events:manage` e admin): botão/formulário escondidos corretamente para o instrutor, aba Reunião em modo leitura, criação→edição→exclusão de evento pelo admin, criação→remoção de designação e de relatório de ocorrência — tudo refletindo no backend real (Postgres local).

## Duas lacunas fechadas: login com 2FA travado e verso do diploma com conteúdo programático (2026-09-17)

1. **Login com 2FA nunca completava — o código correto era rejeitado no backend.** A tela de "Verificação em duas etapas" existia e coletava o código, mas `onSubmitTwoFactor` no `Login.tsx` nunca chamava a API de verificação — não tinha implementação nenhuma, só navegava direto (ou nem isso). Ao implementar a chamada de verdade (`POST /auth/2fa/authenticate` com o `temp_token`), apareceu um segundo bug: o endpoint usava o mesmo DTO estrito do turn-on/turn-off (`@Length(6, 6)`), que rejeita de cara um código de recuperação no formato `xxxx-xxxx-xxxx` (14 caracteres) antes mesmo de chegar na lógica do service que já sabia tratar os dois formatos. Criado `VerifyTwoFactorLoginDto` (`@MaxLength(20)`) usado só nesse endpoint de login — turn-on/turn-off continuam exigindo TOTP de 6 dígitos, como deve ser. Validado via Playwright: login completo com usuário de teste (2FA ativado, código TOTP gerado por `otplib` a partir do segredo decriptado do banco) chega em `/dashboard` de verdade.
2. **Certificado não tinha "verso" com o conteúdo programático da turma**, diferente da referência física enviada pelo usuário (que tem 2ª página com carga horária/tópicos por módulo). Adicionado `Course.syllabus` (texto livre — carga horária/conteúdo variam demais entre cursos de brigada pra valer a pena modelar uma estrutura rígida de módulos/horas) com campo no formulário de turma (criação e edição) e nova página landscape A4 no PDF (`drawSyllabusPage`), gerada só quando a turma tem `syllabus` preenchido. Bug encontrado e corrigido durante a validação visual: a página nova usava `height` fixo no `.text()` do pdfkit, que silenciosamente corta o texto que não coube em vez de continuar em nova página — com um conteúdo programático realista (3 módulos, ~20 linhas) as últimas linhas ("RCP — Reanimação Cardiopulmonar", "Hemorragias") desapareciam sem nenhum erro. Corrigido removendo o `height` fixo (deixando o pdfkit paginar sozinho) e redesenhando a moldura em toda página extra via listener `pageAdded`. Validado gerando PDF de verdade e inspecionando visualmente (`pdftoppm`): com conteúdo longo, o texto completo aparece corretamente na 2ª página; sem `syllabus`, o certificado continua com 1 página só (sem regressão).

## E-mail transacional completo + criação de academia com admin (2026-09-18)

Até aqui, criar uma academia (`Organization`) não definia seu administrador — exigia um
segundo passo manual via `POST /users` — e o envio de e-mail era mínimo (`EmailService`:
2 métodos com HTML inline, só usados por reset de senha e alerta de certificado). Pedido
explícito: no mesmo formulário de criação, o SUPER_ADMIN já define o ORG_ADMIN da
academia, que recebe um e-mail de boas-vindas com link de ativação; e portar a
infraestrutura de e-mail do maskotCrmEdu **por completo**, incluindo Resend por-academia
(chave própria com fallback pra conta global da plataforma) e o construtor visual
drag-and-drop real do maskotCrmEdu (não o pacote Unlayer, que está no `package.json` de
lá mas nunca é importado em lugar nenhum — confirmado por grep).

- **Backend**: `EmailTemplate` (Prisma) + `EmailTriggerType` (`ORGANIZATION_ADMIN_WELCOME`,
  `PASSWORD_RESET`, `CERTIFICATE_EXPIRING`), `Organization.resendApiKey`/`emailFromAddress`/
  `emailFromName`. Módulos novos: `communications/` (envio via Resend, resolve conta
  própria-da-academia vs. global-da-plataforma), `email-templates/` (CRUD + busca por
  gatilho, override de academia sobrepõe o padrão global), `transactional-email/`
  (orquestração: monta o contexto de merge tags, renderiza e chama `communications`),
  `common/merge-tag.service.ts` (motor de `{{tag}}` com filtros e condicionais). `EmailService`
  antigo foi removido — `auth.service.ts` (reset de senha) e `certificates.service.ts`
  (certificado vencendo) migrados pro novo sistema. `OrganizationsService.create()` agora
  cria `Organization` + `User` (`ORG_ADMIN`, senha aleatória nunca exposta) na mesma
  transação e dispara o e-mail de boas-vindas fora dela (fire-and-forget, nunca bloqueia
  nem derruba a criação da academia). Link de ativação reaproveita
  `AuthService.createPasswordResetToken` (agora público) — "definir minha primeira senha"
  usa o mesmo fluxo de "redefinir senha", sem tela nova.
- **Frontend**: formulário de criação de academia ganha nome/e-mail do admin (só na
  criação); edição ganha seção de configuração de e-mail da academia (chave Resend nunca
  volta em texto puro pro frontend, só um booleano "já configurada"). Nova tela
  `/admin/email-templates` (lista) + `/admin/email-templates/:id/edit` (editor visual,
  construtor `EmailBuilder` portado quase 1:1 de
  `MaskotCrmEdu/frontend/src/components/email-builder/` — dnd-kit + tiptap, ~30 arquivos,
  ~10 mil linhas — com o sub-recurso de "blocos reutilizáveis" removido de propósito, sem
  model/backend próprio pra isso aqui).
- **Fora de escopo, deliberadamente**: rastreio de abertura/bounce por webhook,
  verificação de domínio DNS in-app (a academia usa a chave Resend da própria conta, já
  verificada por fora), construtor de campanha em massa, qualquer lógica de billing/
  suspensão de envio (a chave do produto original pra decidir remetente da plataforma vs.
  da escola envolvia plano/pagamento — aqui virou uma regra fixa: boas-vindas/reset de
  senha sempre saem pela plataforma, certificado vencendo sempre pela academia).
- **Limite desta rodada**: sem Docker disponível no ambiente em que isso foi construído,
  não foi possível rodar contra um Postgres real como na validação end-to-end de
  2026-09-17 — a verificação foi `tsc --noEmit` limpo (backend e frontend) + a migration
  SQL escrita à mão conferida contra `prisma migrate diff --from-empty` (bate 100%) +
  revisão manual de código, que já pegou e corrigiu 3 bugs reais antes de qualquer teste
  automatizado (e-mail de teste não processava merge tags sem `designJson`; e-mail de
  certificado vencendo não populava o nome da academia no rodapé; `GROUP_ADMIN` liberado
  no frontend mas bloqueado no backend). **Falta**: validar de ponta a ponta contra um
  Postgres real (criar academia → e-mail chega → link ativa conta → editor visual salva e
  reflete no próximo envio → chave Resend por-academia realmente isola o envio).

## Decisões fechadas

### Arquitetura geral
1. **Repositório novo e separado**, não fork do `maskotCrmEdu`. Copiar/colar módulos específicos como ponto de partida.
2. **`Event`** = entidade única polimórfica (tronco: tipo, local, data, unidade) com tabelas-filhas por tipo:
   - tipo `TURMA` → relação com `Turma`/aulas/matrícula
   - tipo `ASSEMBLEIA`/`CONGRESSO`/`ATUACAO_BRIGADA` → relação com `RelatorioOcorrencia` + `Designacao`
3. Produto é **SaaS multi-cliente** (multi-tenant, como o Maskot é hoje) → reaproveita a camada de plataforma (equivalente ao `AdminController`: gestão de academias-clientes, grupos matriz→filiais).
4. **Sem módulo financeiro no MVP** (`Contract`/`Invoice`/`PaymentPlan` ficam para uma fase futura, se cursos passarem a ser cobrados).
5. Onboarding de academia-cliente nova: **manual**, feito pelo `SUPER_ADMIN` da plataforma (sem autocadastro/self-service no MVP).

### Pessoas e papéis
6. Brigadista/bombeiro designado para eventos de atuação pode ser **aluno formado da própria escola OU profissional externo**.
7. Staff (brigadista/bombeiro) **tem conta própria e acessa o app** (login, vê designações/escalas).
8. Quando o staff é ex-aluno, é o **mesmo cadastro de pessoa** — um `User` que acumula papéis (aluno + membro de equipe), reaproveitando o padrão `UserSchoolAccess`/`RoleAssignment`. Não duplica cadastro.
9. Promoção de aluno formado para staff disponível para designação é **manual**, feita pelo admin (controle de qualidade sobre quem entra na equipe de atuação).
10. Certificação de profissional externo (não formado pela escola) é **registro manual pelo admin** (nome do curso, validade, upload de comprovante) — sem autocadastro de terceiros.

### Portais
11. **Portal único web**, com views diferentes por papel (reaproveitando o sistema de permissões existente) — não há portais separados por tipo de usuário.
12. **App mobile nativo já no MVP**, priorizando papéis de campo (staff/brigadista/instrutor — uso durante evento/aula: escala, presença, ocorrência). Aluno e admin usam o web por enquanto. Não reaproveita o app mobile atual do Maskot (é voltado à equipe comercial/CRM) — precisa ser construído do zero, mesma base de auth/API.

### Eventos
13. Eventos de atuação (assembleia/congresso) são **sempre internos** — não há contratante externo a modelar (sem entidade "Cliente/Contratante").
14. Designação de staff em evento de atuação usa **escala com turnos/horários** (não é uma designação única para o evento inteiro).
15. Público geral do evento: apenas **contagem agregada** (ex.: "estimativa de 350 presentes"), sem registro nominal individual de cada pessoa do público.

### Certificado, crachá e reciclagem
16. Certificado é emitido **automaticamente** quando os critérios da turma são atingidos.
17. Critérios de emissão (presença mínima + conclusão das aulas) são **configuráveis por turma/curso** (cursos de brigada variam muito em carga horária/exigência).
18. **Sem avaliação/prova no MVP** — emissão depende só de presença + aulas assistidas (sem nota mínima).
19. Reciclagem com **gestão ativa**: sistema alerta vencimento, vincula/sugere curso de reciclagem, e **bloqueia designação de staff com certificado vencido** em eventos de atuação.
20. Certificado/crachá é **válido em toda a rede** da academia (todas as filiais/unidades), não só na unidade que emitiu.
21. Personalização visual (logo da unidade, assinatura do diretor/instrutor) do certificado/crachá **por academia-cliente já no MVP**.

### Permissões e portais (fechadas em 2026-09-02, ao iniciar a Fase 1)
22. **Dois mecanismos de acesso distintos**, não um só: (a) **permissões granulares** (`Permission`/`RoleAssignment`, cargo configurável por organização) para *delegar* administração a membros da equipe que não são `ORG_ADMIN` (secretaria, coordenador de eventos etc.); (b) **posse do dado** (não é permissão — permissão vale para a organização inteira) para aluno/professor só verem o que é seu: aluno vê sua matrícula/certificado/escalação, professor vê só as turmas onde é instrutor. O mecanismo (b) ainda não foi implementado (Fase 2/3 do Estado de implementação).
23. `ORG_ADMIN`/`GROUP_ADMIN` sempre têm acesso administrativo pleno — **não dependem de ter um cargo atribuído**. Cargo (`RoleAssignment`) é só para dar a alguém que não é admin um recorte de permissões específico.
24. Catálogo de permissões da Fase 1 é **grosso**: 1 permissão por módulo de domínio (`courses:manage`, `events:manage`, `certificates:manage`, `staff:manage`, `people:manage`), não 1 por ação (create/read/update/delete separados). Refinar para granularidade maior é trabalho futuro, só se a equipe pedir.

### E-mail transacional (fechadas em 2026-09-18)
25. Criação de academia define o **ORG_ADMIN no mesmo formulário** (nome+e-mail) — sem passo manual separado via `POST /users` depois.
26. Administrador recém-criado nunca recebe senha em texto puro — só um **link de ativação** que reaproveita o fluxo de "redefinir senha" já existente (mesmo token JWT stateless, mesma tela `/reset-password`).
27. E-mails "da plataforma para a academia" (boas-vindas do admin, redefinição de senha) **sempre saem pela conta/remetente da plataforma**, mesmo que a academia tenha Resend próprio configurado — só o e-mail de certificado vencendo (academia para o próprio aluno) usa a conta da academia quando ela tem uma.
28. Templates de e-mail ficam no banco (`EmailTemplate`), com **override por academia sobre um padrão global** — não hardcoded no código como antes.
29. Construtor visual de e-mail é o **bespoke real do maskotCrmEdu** (dnd-kit + tiptap), não o pacote Unlayer — decisão consciente após checar que o Unlayer está listado no `package.json` de lá mas nunca é usado.
30. **Fora do MVP deste módulo**: rastreio de abertura/bounce, verificação de domínio DNS in-app, construtor de campanha em massa, cota/billing de envio.

### Cadastro — campos adicionais de pessoa (fechada em 2026-09-19)
31. Adicionados a `StudentProfile` (não a `User` nem a `StaffMember`): `baptismDate`, `pioneerStatus` (enum `PioneerStatus`: `AUXILIARY`/`REGULAR`, ausente = não é pioneiro), `signedPetitions` (`String[]`, nomes livres das petições assinadas — não é um enum fechado porque a lista de petições é definida por cada organização/congregação, não pelo produto) e `profession` (texto livre, profissão ou área de estudo). Ficam em `StudentProfile` e não em `User` porque hoje **todo cadastro de pessoa passa pela tela de Alunos** (`Students.tsx`/`POST /users` com `studentProfile` aninhado — decisão 8): não existe formulário de cadastro completo separado para professor/staff (`Staff.tsx` só promove um `User` já existente, sem campos próprios). Terminologia (batismo/pioneiro/petição) é do domínio da organização-cliente atual (uso religioso do produto), não do "brigadista"/"bombeiro" do MVP original — ver cabeçalho deste documento.

### Certificação externa — mudança de dono (fechada em 2026-09-19)
32. `ExternalCertification` deixa de pertencer a `StaffMember` (decisão 10 original) e passa a pertencer direto a `User` (`staffMemberId` → `userId`, com migração de dados preservando os registros existentes via join por `StaffMember.userId`). Motivo: certificação/qualificação prévia (ex: já era Bombeiro Civil ou Brigadista Intermediário antes de entrar na academia) é um **fato sobre a pessoa**, não sobre um papel específico — antes disso, só quem já tinha sido promovido a staff de atuação podia ter uma registrada, o que forçaria "promover" um professor/instrutor só para guardar essa informação, mesmo que ele nunca fosse escalado num evento. O endpoint migrou de `POST /staff/:id/external-certifications` para `POST /users/:id/external-certifications` (permissão `people:manage`, não mais `staff:manage`) e `assertHasValidQualification` (decisão 19) agora busca `ExternalCertification` por `userId` diretamente em vez de via relação do `StaffMember` — comportamento de bloqueio de designação não muda. A tela em `Staff.tsx` continua sendo o único lugar hoje que expõe essa certificação (lida via `member.user.externalCertifications`), porque ainda não existe uma tela de gestão de professor/instrutor à parte — só a ligação de dados foi corrigida.

### Reaproveitar quase pronto
| Maskot Edu | Novo projeto | Observação | Status |
|---|---|---|---|
| `School` (+ `isMatrix`/`parentSchoolId`) | `Academia` (tenant) | Renomear, manter hierarquia matriz→filiais | ✅ |
| `AdminController` / `SchoolOperationsController` | Painel de plataforma (SUPER_ADMIN) | Gestão de academias-clientes, onboarding manual | ✅ |
| `UserSchoolAccess` + `RoleAssignment` + `Permission` + `SystemRole` | Cargo por unidade + papel de plataforma | Já resolve staff/instrutor com cargo diferente por filial | ✅ Fase 1 (cargo/permissão) + Fase 2 (posse de dado no backend) + Fase 3 (gating de nav/rotas e dashboard role-aware no frontend) |
| Auth (JWT + refresh + 2FA) | Auth | Sem alteração | ✅ |
| `Course`, `Student`, `Enrollment`, `TeacherCourseSubject`, `Room`, `TimetableEntry`, `ClassLog`, `Attendance` | `Turma`, `Aluno`, `Matricula`, designação instrutor↔turma, sala, grade horária, diário de aula, presença | Renomear, podar campos comerciais (`soldByUserId`, `churnScore`) | ✅ |
| `TrainingModule`/`TrainingLesson`/`TrainingProgress` + upload presigned R2 | Vídeo-aulas por turma | Hoje é global/interno da Maskot; passa a ser por turma + gated por matrícula | ✅ |
| `StudentsService.enrollStudent()` | Fluxo de matrícula | Remover parte de `Lead`/financeiro | ✅ |
| `UserAvailability` + `TimeOff` + `ScheduleSettings` + `EventType` + `Visit` + Google Calendar OAuth | Agenda de reuniões periódicas | Google Meet automático já ligado na criação de evento tipo REUNIAO | ✅ |
| `notifications/` + push (web/mobile) | Alertas de vencimento de certificado | Push mobile fica pendente do app mobile; in-app + e-mail já funcionam | ✅ (in-app + e-mail) |
| `communications/` + `email-templates/` + `transactional-email/` + `common/services/merge-tag.service.ts` + `components/email-builder/` (frontend) | Mesma estrutura, `School`→`Organization` | Sem billing/suspensão, sem tracking de bounce, sem verificação de domínio DNS, sem "blocos reutilizáveis" — ver decisões 25-30 | ✅ (falta validação end-to-end contra Postgres real, ver seção "E-mail transacional completo") |

### Construir do zero
- `Event` genérico polimórfico (tronco + tabelas-filhas por tipo) — ver decisão 2. **✅**
- Certificado/Diploma: model com validade, template por academia, critérios configuráveis por turma, geração de PDF (inspirar no padrão `jsPDF` existente, mas provavelmente server-side). **✅** (PDF via `pdfkit`, server-side)
- Crachá digital + QR de validação pública: reaproveitar a técnica de QR (hoje usada só em 2FA) e o padrão de link público com token/expiração do módulo Drive (`SharedLink`). **✅**
- Staff/membro de equipe: papel adicional sobre `User` (não entidade separada) — ver decisões 6-9. **✅**
- Designação com escala/turnos dentro de evento de atuação. **✅**
- Relatório de ocorrência generalizado (hoje `StudentOccurrence` é só por aluno; precisa aceitar vínculo a `Event` também). **✅**
- Permissões granuladas + posse de dado para portal de aluno/professor — ver decisões 22-24. **✅ Fases 1, 2 e 3 feitas** (cargo/permissão, posse no backend, gating de nav/rotas + dashboard role-aware + páginas `/my-*` no frontend).
- App mobile novo (Expo/React Native), focado em staff/instrutor. **⏸️ adiado para fase futura — não é próximo passo do MVP web**

### Descartar
WhatsApp/Instagram/Messenger, chatbot de vendas, `EnrollmentCampaign` (é campanha de marketing, não matrícula), funil de leads, cupons/addons de SaaS, módulo financeiro completo (por enquanto).

## Próximos passos (ordem sugerida)
1. ~~**Permissões — Fase 2**: endpoints "meus dados", checagem de posse nos services já existentes, `AuthService.getProfile` enriquecido.~~ **✅ feito em 2026-09-17.**
2. ~~**Permissões — Fase 3**: dashboards/portais dedicados de aluno e professor no frontend, consumindo `/me/*`.~~ **✅ feito em 2026-09-17** (dashboard role-aware + `/my-courses`/`/my-certificates`/`/my-designations` + gating de nav/rotas por permissão).
3. ~~**App mobile** (decisão 12)~~ — **adiado para fase futura (2026-09-17), fora do próximo passo do MVP web.**

Com Fases 1-3 de permissões fechadas e o mobile adiado, os candidatos a próximo passo são os itens já registrados como pendência parcial ou em aberto (ver seções abaixo) — falta decidir qual priorizar.

## Itens menores em aberto (não bloqueiam a codificação)
- Nome definitivo do projeto/produto: **fechado como Ignis** (2026-09-19). Nomes visíveis no código (títulos, telas de login, `package.json`) já atualizados; pasta local e repositório GitHub seguem com o nome antigo (`sistema-brigada`) até decisão de renomear o repo.
- Layout de impressão do diploma (além do PDF gerado, algum requisito de gráfica/papel especial?).
- Terminologia final dos papéis do sistema no schema (`SUPER_ADMIN`, admin de academia, instrutor, aluno, staff/brigadista etc.) — resolver ao desenhar o schema Prisma.
- Refinar o catálogo de permissões (decisão 24) para granularidade por ação, se a equipe administrativa pedir.
- ~~Decisão 19 só está parcialmente implementada...~~ **✅ completa em 2026-09-17**: `DesignationsService.create` (`assertHasValidQualification`) agora bloqueia com 409 quando o staff só tem certificado de turma e/ou certificação externa vencidos (sem nenhuma qualificação válida no momento); quem nunca teve nenhuma das duas não é bloqueado. Achado à parte, não corrigido agora por estar fora do pedido: `Certificate.status` nunca é escrito como `EXPIRED` por nenhum job — a checagem de vencimento (aqui e em `notifyExpiringCertificates`) sempre compara `expiresAt` diretamente, então isso não afeta o bloqueio, mas o enum `EXPIRED` fica sem uso real hoje.

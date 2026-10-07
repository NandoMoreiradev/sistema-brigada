# Decisões do projeto — Escola de Treinamento de Brigada e Segurança

> Nome do projeto/produto: **Pronthea** (nome anterior, Ignis, não estava disponível pra registro — trocado em 2026-09-25). Base de código de referência: `maskotCrmEdu` (CRM/plataforma para escolas, NestJS + Prisma + React).

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
- ✅ Autocadastro público de pessoas (2026-09-25) — link público por academia (opt-in, com token regenerável) onde qualquer um se cadastra sem login; fica `PENDING` até alguém com `registrations:manage` aprovar (cria `User`+`StudentProfile` de verdade e manda e-mail com credenciais, gatilho `REGISTRATION_APPROVED`) ou recusar. Campos opcionais do formulário são configuráveis por academia. Ver seção própria abaixo.

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

## Autocadastro público de pessoas (2026-09-25)

Pedido: permitir que uma academia receba cadastro de pessoas via link público (sem
login) e, ao ter o cadastro aprovado, o sistema envia automaticamente um e-mail com os
dados de acesso, usando um template criado pelo SUPER_ADMIN e reutilizável pela
academia — reaproveitando 100% a arquitetura de `EmailTemplate` (padrão global +
override por academia) já existente pros outros 4 gatilhos.

- **Backend**: `Organization.publicRegistrationEnabled`/`publicRegistrationToken`/
  `publicRegistrationFields` (opt-in por academia — token sobrevive a
  desativar/reativar, só "gerar novo link" troca). Novo model `RegistrationRequest`
  (status `PENDING`/`APPROVED`/`REJECTED`, campos opcionais de `StudentProfile`
  soltos até a aprovação). Novo gatilho `EmailTriggerType.REGISTRATION_APPROVED`
  (fora de `PLATFORM_TRIGGERS`: sai pelo Resend da própria academia, igual
  `USER_WELCOME`/`CERTIFICATE_EXPIRING`). Nova permissão `registrations:manage`
  (dedicada, não `people:manage` — permite delegar a revisão sem dar acesso total a
  Alunos/Equipe). Novo módulo `registrations/`: controller público
  (`GET`/`POST /public/registrations/:token`, sem `JwtAuthGuard` — mesmo padrão
  "público por omissão" de `PublicBadgeController` —, com throttling local de 5/min)
  e controller admin (`GET`/`PATCH /registrations`, gated por `registrations:manage`).
  `UsersService.create()` foi refatorado: o miolo de criação de conta (senha
  aleatória, `User`+`StudentProfile` em transação, link de ativação) virou
  `createAccount()`, reutilizado tanto pelo cadastro manual (`create()`, dispara
  `USER_WELCOME`) quanto pela aprovação de autocadastro (`RegistrationsService.approve()`,
  dispara `REGISTRATION_APPROVED`) — zero duplicação de lógica de criação de conta.
  Aprovação sempre cria `Role.ORG_USER`+`StudentProfile` (nunca ORG_ADMIN — autocadastro
  não é caminho de escalação). Submissão pública nunca confia no payload do cliente pra
  decidir quais campos opcionais gravar: sempre filtra pelo
  `publicRegistrationFields` da academia no servidor; duplicata de `PENDING` pro
  mesmo e-mail é ignorada silenciosamente (mesma mensagem de sucesso, não vaza quem
  já se cadastrou).
- **Frontend**: nova seção "Autocadastro público" em Configurações → Academia (toggle,
  checkboxes sobre o catálogo fixo de 4 campos opcionais, link com copiar/regenerar);
  nova página pública `/register/:token` (form dinâmico pelos campos habilitados,
  reaproveita os mesmos widgets de `People.tsx` pra pioneiro/petições); nova tela
  `/registrations` ("Cadastros pendentes", gated por `registrations:manage`, nav item
  novo em `MainLayout`) com aprovar (modal pré-preenchido, editável antes de confirmar)
  /recusar (confirmação simples, sem e-mail).
- **Validado de ponta a ponta contra um Postgres real** (diferente da rodada anterior de
  e-mail, que não teve banco disponível): migration aplicada e conferida com
  `prisma migrate diff` (diff vazio = schema bate 100%), seed idempotente (permissão
  nova + template padrão novo), fluxo HTTP completo via curl (ativar → submeter →
  campo não habilitado é filtrado → duplicata ignorada → listar → aprovar com override
  → dupla-aprovação bloqueada (400) → recusar → regenerar token invalida o link antigo)
  e inspeção visual via Playwright/Chromium (formulário público, impersonação de
  ORG_ADMIN, seção de configurações, tela de pendentes, modal de aprovação) — sem
  regressão no `POST /users` original (cadastro manual) após a extração de
  `createAccount()`.

## Decisões fechadas

### Arquitetura geral
1. **Repositório novo e separado**, não fork do `maskotCrmEdu`. Copiar/colar módulos específicos como ponto de partida.
2. **`Event`** = entidade única polimórfica (tronco: tipo, local, data, unidade) com tabelas-filhas por tipo:
   - tipo `TURMA` → relação com `Turma`/aulas/matrícula
   - tipo `ASSEMBLEIA`/`CONGRESSO` → relação com `RelatorioOcorrencia` + `Designacao`
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

### Remoção do tipo de evento `ATUACAO_BRIGADA` (fechada em 2026-09-22)
33. O `EventKind` tinha três valores para "evento de atuação" (`ASSEMBLEIA`/`CONGRESSO`/`ATUACAO_BRIGADA`), mas os três sempre apontaram para a mesma tabela-filha `EventOperation` e nunca tiveram nenhuma regra de negócio, campo de formulário ou permissão diferente entre si em nenhum lugar do código (backend: `OPERATION_KINDS` sempre os tratou como bloco único; frontend: `isOperation` idem) — a única diferença era o rótulo mostrado ("Assembleia"/"Congresso"/"Atuação de brigada"). Além disso `ATUACAO_BRIGADA` misturava categorias diferentes: `ASSEMBLEIA`/`CONGRESSO` descrevem o tipo de ocasião, enquanto "atuação de brigada" descreve a atividade que a equipe de segurança já exerce **dentro** de uma assembleia ou congresso (a decisão 13 já tratava "eventos de atuação" como sinônimo de assembleia/congresso). Removido o valor do enum; eventos existentes com esse `kind` são reclassificados como `ASSEMBLEIA` na migration (`20260922084022_remove_atuacao_brigada_event_kind`), preservando designações/escalas/ocorrências/postos já registrados. `EventKind` fica só com `TURMA`/`ASSEMBLEIA`/`CONGRESSO`/`REUNIAO`.

### E-mails e comunicados — envio avulso pra pessoas da academia (fechada em 2026-09-22)
34. Novo model `Communication` (+ `CommunicationRecipient`, um registro por pessoa por envio) pra e-mail avulso ("comunicado") que um admin ou cargo delegado escreve e manda pra um público-alvo da própria academia (todos/alunos/equipe/pessoas específicas) — diferente de `EmailTemplate` (templates dos 3 gatilhos automáticos: boas-vindas, redefinição de senha, certificado vencendo), que nunca manda nada por conta própria. Reaproveita 100% a infra de renderização/envio já existente (`EmailRendererService`/`MailService`/`MergeTagService`, `communications/`) e o mesmo construtor visual drag-and-drop (`EmailBuilder`) usado na edição de template. Envio é fire-and-forget em background (mesmo padrão do e-mail de boas-vindas de academia nova) com um pequeno delay sequencial entre destinatários — sem fila/dependência nova, adequado ao porte modesto das organizações deste produto. Tem rastreio de abertura via pixel 1x1 num endpoint público sem autenticação (`GET /public/communications/recipients/:id/open.gif`, mesmo padrão de `PublicBadgeController`) e mostra quem criou o comunicado (nome + data/hora) em toda listagem/detalhe.
35. Nova permissão granular `communications:manage` no catálogo, cobrindo tanto Modelos de e-mail (`EmailTemplatesController`, que migrou de `@Roles` fixo pra essa permissão) quanto Comunicados — as duas telas moram juntas em "E-mails e comunicados" (`/admin/emails`, abas verticais no mesmo padrão de `Settings.tsx`). `ORG_ADMIN`/`GROUP_ADMIN`/`SUPER_ADMIN` continuam com acesso pleno (bypass já existente em `userHasPermission`); a permissão só abre a porta pra um cargo delegado (ex.: secretaria) sem precisar ser admin.

### Autocadastro público (fechadas em 2026-09-25)
36. E-mail de credenciais usa gatilho **novo e dedicado** (`REGISTRATION_APPROVED`), não reaproveita `USER_WELCOME` — mensagem de "seu cadastro foi aprovado" é semanticamente diferente de "um admin te cadastrou", mesmo os dois criando conta do mesmo jeito.
37. Revisão de cadastros pendentes usa permissão **nova e dedicada** (`registrations:manage`), não `people:manage` — permite delegar essa revisão (ex: recepção) sem dar acesso total à tela de Pessoas.
38. Formulário público tem **campos opcionais configuráveis por academia**: nome/e-mail/telefone sempre obrigatórios; os 4 campos opcionais de `StudentProfile` (batismo/pioneiro/petições/profissão) a academia escolhe quais aparecem, via toggle sobre um catálogo fixo (não é form-builder livre).
39. Autocadastro é **opt-in por academia**: precisa ativar em Configurações, o que gera um link/token único (regenerável, invalidando o anterior; sobrevive a desativar/reativar). Sem isso, nenhuma academia ganharia o link "de graça" sem decidir usar.

### Turma com vários professores (fechadas em 2026-09-29)
40. Responsabilidade é **opt-in e retrocompatível**: módulo sem responsável e aula sem professor escalado continuam com a regra antiga (qualquer `CourseInstructor` da turma). Só passa a restringir quando alguém é marcado, então nenhuma turma existente muda de comportamento.
41. **Responsável por módulo** (`CourseModuleInstructor`) e **professor da aula presencial** (`ClassSessionInstructor`) são sempre subconjunto dos instrutores da turma (validado no service). Quem sai da turma (`removeInstructor`) sai também dessas listas.
42. Aula presencial ganha `topic` (assunto) e o **diário passa a ser um por professor** (`ClassLog` único por `(aula, autor)`), para dois professores no mesmo dia não se sobrescreverem. Os diários dos colegas aparecem só para leitura.
43. Excluir vídeo-aula é do admin (`courses:manage`) ou de **responsável explícito** pelo módulo — em módulo sem responsável, qualquer instrutor edita mas não apaga. Criar/excluir módulo e definir responsáveis seguem exclusivos de `courses:manage`.
44. Lista de presença (`GET .../attendance`) e diários (`classLogs` em `GET .../sessions`) deixaram de ser legíveis por qualquer membro da organização: exigem `courses:manage` ou ser instrutor da turma (e, com escala, um dos escalados). Aluno continua vendo a agenda (assunto/professor), sem diários.
45. Escolher instrutor (nova turma / editar turma) usa a lista enxuta `GET /users/roster`, sem exigir `people:manage`.

### Escala de eventos com vários dias e turnos (fechadas em 2026-09-29)
46. **Turno é entidade do evento** (`EventShift`: nome + início + fim), **igual para todos os postos**. O "dia" não é tabela: deriva do início do turno no fuso do app. Turno pode atravessar a meia-noite (Noite 22:00–02:00). Único por `(evento, início, fim)`.
47. **Designação = pessoa × turno × posto.** Uma pessoa pode estar em turnos diferentes por dia (manhã num dia, dia todo em outro): o lote escala pessoas × turnos de uma vez, uma notificação/e-mail por pessoa. `Designation.shiftStart/shiftEnd` continuam gravados (cópia do turno) — "minhas escalas" e o conflito entre eventos não dependem da tabela de turnos. Migration cria um turno por janela distinta já usada e liga as designações existentes.
48. **Passagem de turno**: turnos que encostam (12:00/12:00) não conflitam; sobreposição entre turnos é permitida (passagem com sobreposição) mas a mesma pessoa não pode estar em dois turnos sobrepostos (nem dentro do mesmo lote). A tela de turnos avisa lacuna (posto sem cobertura) ou sobreposição entre turnos seguidos do dia.
49. **Remarcar um turno** propaga o novo horário às designações dele, depois de revalidar o conflito de cada pessoa; **excluir turno** só se não tiver ninguém escalado.
50. **Quem recusou não conta em nenhuma saída** (mapa, matriz, texto, impressão): antes a recusa ainda ocupava a vaga do posto e saía na escala impressa. Pendente conta, mas vem marcado (`*` / "pendente").
51. **Um modelo único** (`frontend/src/utils/schedule.ts`: dia → turno → posto → pessoas) alimenta lista, matriz de cobertura, mapa (tela, PNG e impressão) e os dois textos (grupo e por pessoa) — as saídas não divergem entre si. Capacidade continua por posto (não por turno).
52. **Mapa mostra um turno por vez** (ou o resumo do dia), com os **nomes direto no mapa** (cartões posicionados sem sobreposição por `layoutLabels`). PNG e impressão usam a mesma folha (`MapSheet`) com cabeçalho (dia + turno), legenda e carimbo "gerada em"; impressão = uma folha A4 paisagem por turno.
53. **Um evento pode ter várias plantas baixas** (`EventFloorPlan`, até **10** por evento). Cada planta é uma área/andar que funciona ao mesmo tempo (térreo, mezanino, externa) — não uma versão da mesma planta. O nome é opcional só na primeira (vira "Planta 1") e **obrigatório da segunda em diante**, único no evento (sem diferenciar maiúsculas); é a aba do mapa e o título da folha.
54. **Cada posto pertence a uma só planta** (`EventPost.floorPlanId`). Um local que precisa aparecer em duas plantas é cadastrado como dois postos. Mover um posto de planta o recoloca no centro da nova planta (a posição antiga não vale na outra imagem). Uma planta com postos **não pode ser excluída** (409): mova os postos antes.
55. **Saídas com várias plantas**: impressão = uma folha por **turno e planta** (escolhe-se plantas × turnos; o cabeçalho traz o nome da planta); PNG = a planta da aba aberta (nome da planta no arquivo). Texto do grupo agrupa os postos por planta dentro de cada turno; texto por pessoa cita a planta (`Portão A (Mezanino)`). Com **uma planta só**, nada disso aparece — saídas idênticas às de antes. A aba de cada planta mostra um alerta com quantos postos estão sem ninguém no turno escolhido.
56. **Migração**: cada evento que já tinha `floorPlanUrl` ganhou uma "Planta 1" e todos os seus postos foram ligados a ela. `EventOperation.floorPlanKey/floorPlanUrl` ficam como legado (não são mais lidos pela tela); o endpoint antigo `PATCH posts/floor-plan` continua funcionando e passa a trocar a imagem da primeira planta.

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
- Nome definitivo do projeto/produto: fechado como Ignis em 2026-09-19, **renomeado para Pronthea em 2026-09-25** (Ignis não estava disponível pra registro de marca). Nomes visíveis no código (títulos, telas de login, `package.json` dos três apps) já atualizados; pasta local e repositório GitHub seguem com o nome antigo (`sistema-brigada`) até decisão de renomear o repo.
- Layout de impressão do diploma (além do PDF gerado, algum requisito de gráfica/papel especial?).
- Terminologia final dos papéis do sistema no schema (`SUPER_ADMIN`, admin de academia, instrutor, aluno, staff/brigadista etc.) — resolver ao desenhar o schema Prisma.
- Refinar o catálogo de permissões (decisão 24) para granularidade por ação, se a equipe administrativa pedir.
- ~~Decisão 19 só está parcialmente implementada...~~ **✅ completa em 2026-09-17**: `DesignationsService.create` (`assertHasValidQualification`) agora bloqueia com 409 quando o staff só tem certificado de turma e/ou certificação externa vencidos (sem nenhuma qualificação válida no momento); quem nunca teve nenhuma das duas não é bloqueado. Achado à parte, não corrigido agora por estar fora do pedido: `Certificate.status` nunca é escrito como `EXPIRED` por nenhum job — a checagem de vencimento (aqui e em `notifyExpiringCertificates`) sempre compara `expiresAt` diretamente, então isso não afeta o bloqueio, mas o enum `EXPIRED` fica sem uso real hoje.

### Convites e acesso de novas pessoas (fechadas em 2026-09-30)
48. **Papel de cadastro** (`RegistrationKind`: aluno, instrutor, equipe) vale para autocadastro e convite. Aluno recebe `StudentProfile`; instrutor fica sem perfil (é escalável em turmas); equipe fica sem perfil e já é promovida a `StaffMember`. Sempre `Role.ORG_USER`. No link público, `?tipo=` é só sugestão: quem revisa confirma o papel.
49. **Convite dirigido** (`RegistrationInvite`): e-mail + papel, link único de 7 dias (`/convite/:token`), um convite em aberto por e-mail (convidar de novo cancela o anterior). Ao ser preenchido a conta é criada na hora — o convite é a autorização e quem convidou fica como revisor. O convite é "reservado" de forma atômica (`usedAt`) e devolvido se a criação da conta falhar.
50. **Resultado do e-mail de acesso é gravado** (`accessEmailStatus` SENT/FAILED em `RegistrationRequest`, `emailStatus` em `RegistrationInvite`). Para isso o transacional passou a usar `sendSingleOrThrow`: com `sendSingle` toda falha aparecia como enviada. A aprovação continua não falhando por causa do e-mail.
51. **Reenviar acesso** (`POST /users/:id/resend-access` e `/registrations/:id/resend-access`) gera novo link de 7 dias e reenvia o e-mail de boas-vindas/aprovação. Link de primeiro acesso passou de 1h para 7 dias; redefinição de senha ("esqueci") segue 1h.
52. **Recusa avisa a pessoa** por e-mail (`REGISTRATION_REJECTED`, motivo opcional, dá para desmarcar) e cadastro novo notifica no sino admins e quem tem `registrations:manage`; o menu mostra a contagem de pendentes.
53. **Dados pessoais em `PersonProfile`, para qualquer papel** (nascimento, gênero, batismo, pioneiro, petições, profissão). `StudentProfile` ficou só com o que é de aluno (saúde, responsável, matrículas). A migração copia os dados existentes (mesmo id) antes de remover as colunas antigas. `POST/PATCH /users` aceita `personProfile` além de `studentProfile`; autocadastro e convite gravam os dados pessoais para aluno, instrutor e equipe, e `birthDate` entrou no catálogo de campos do formulário público.
54. **Campos opcionais do formulário público são por papel**: `publicRegistrationFields` é a lista do aluno; `publicRegistrationFieldsInstructor` e `publicRegistrationFieldsStaff` são as de instrutor e equipe (mesmo catálogo). A migração copia a lista atual para os dois novos, então nenhuma academia muda de comportamento até configurar. O servidor filtra a submissão pela lista do papel pedido (ou do convite); `GET /public/registrations/:token?kind=` devolve os campos daquele papel. Nascimento, batismo etc. continuam sendo gravados em `PersonProfile` para qualquer papel.

55. **Excluir pessoa é soft delete restrito a quem não tem histórico** (`DELETE /users/:id`, `GET /users/:id/deletion-check`, `people:manage`). Bloqueiam a exclusão: matrícula, certificado, escala, relatório/arquivo de ocorrência, turma/módulo/aula como instrutor, diário de aula, progresso de videoaula, presença em reunião, evento/arquivo/comunicado criado — e ainda a própria conta, administrador de plataforma/grupo, admin excluído por quem não é admin e o último admin ativo da academia. A resposta é 409 com a lista de motivos (`blockers`); a tela oferece "Desativar" como alternativa, que preserva tudo. Ao excluir, na mesma transação: apaga sessões (refresh tokens), perfil de aluno/pessoa, equipe, certificações externas, integrações, notificações, disponibilidade e acessos; limpa cargos, permissões diretas, 2FA, telefone e avatar; troca o `publicBadgeToken`; e reescreve o e-mail para `deleted:<id>:<email original>` — o `email` é `@unique` e o soft delete puro do `PrismaService` deixaria o endereço preso. A linha do `User` fica (recuperável, e as referências de autoria sem FK continuam válidas). A restauração e a exclusão definitiva ficam na lixeira (decisão 56).

56. **Lixeira** (`/trash/:entity`, `entity` = `courses | events | people | roles`; permissão nova `trash:manage`, admins passam sempre). Cada página (Turmas, Eventos, Pessoas, Cargos) tem o botão "Lixeira" para quem pode: lista o que foi excluído (soft delete), **restaura** ou **exclui definitivamente** (com confirmação por nome e a lista do que será apagado junto). Regras:
    - **Turma**: restaurar devolve o `Event`, o `Course` e só as matrículas excluídas junto (mesmo `deletedAt`). A cascata do soft delete passou a ser recursiva (Event → Course → Enrollment); antes as matrículas de uma turma excluída continuavam vivas. Excluir definitivamente apaga o `Event` (as FKs `Cascade` levam turma, aulas, matrículas e certificados) e remove do storage vídeos e PDFs.
    - **Evento**: restaurar limpa `deletedAt`; reunião perde `googleEventId`/`meetUrl` (o evento do Google Calendar já foi apagado na exclusão) e o admin é avisado para gerar o Meet de novo. Exclusão definitiva remove também anexos, ocorrências e plantas do storage.
    - **Cargo**: restaurar dá 409 se o nome foi reutilizado por outro cargo (`@@unique [organizationId, name]`).
    - **Pessoa**: restaurar recupera o e-mail original do tombstone (409 se já está em uso) e devolve **só a conta, inativa** — perfil de aluno, equipe, cargos, integrações e sessões foram apagados na exclusão (decisão 55) e não voltam; o admin reativa e readiciona os perfis em Pessoas. Exclusão definitiva é segura porque só se exclui pessoa sem histórico.
    - Tudo restrito à academia ativa; item fora da lixeira → 404. Arquivos do storage só são apagados depois do commit do banco.
    - Ficou fora desta entrega: transferir dados de autoria para outro usuário ao excluir pessoa com histórico, e mover portadores para outro cargo ao excluir cargo em uso (decisão pendente).

### Salas, visão do aluno e programação da turma (fechadas em 2026-10-05)
57. **Sala é da academia, não da turma** (`Room`): a mesma sala serve a várias turmas. A turma tem uma **sala padrão** (`Course.defaultRoomId`), pré-selecionada ao agendar aula; cada aula guarda a própria sala. Sala não se exclui, só se desativa. O backend recusa duas aulas avulsas na mesma sala em horários que se sobrepõem.
58. **Lista de alunos e agenda só para quem é da turma**: `GET .../enrollments` passou a exigir `courses:manage` ou ser instrutor da turma (antes qualquer pessoa da academia recebia nome e e-mail de todos os matriculados); `GET .../sessions` exige ser da coordenação, instrutor ou aluno da turma. O aluno recebe a própria presença em cada aula (`myAttendance`) e o resumo `GET /me/courses/:id/progress`.
59. **Certificado automático só depois da última aula agendada**: com aulas futuras na agenda, `checkEligibility` responde "não elegível". Antes, quem agendava uma aula por vez via o aluno bater 100% (1 de 1) na primeira chamada. Vídeo enviado ao sistema é marcado como assistido sozinho ao terminar (o aluno não marca à mão); link externo continua por autodeclaração.
60. **Programação da turma (rodízio por grupos)**: grupo (`CourseGroup`) é QUEM — um conjunto de alunos; sala é ONDE. O grupo tem uma sala base, mas passa parte do dia em locais fixos de atividades (ex.: Área da prática). Atividades (`CourseActivity`) são cadastradas uma vez na turma com duração, local fixo opcional e responsáveis (equipes `InstructorTeam` e/ou pessoas); a programação de cada grupo num dia (`ScheduleBlock`) é só a ordem — os horários são calculados. Conflitos (sala ocupada, pessoa em dois lugares, inclusive entre turmas) são avisos, não bloqueios. Quem é escolhido como responsável vira instrutor da turma.
61. **Chamada por período**: cada trecho do dia entre refeições (atividade do tipo `MEAL`) vira uma `ClassSession` com `fromSchedule = true` e `groupId` do grupo — é nela que se faz a chamada, com só os alunos do grupo. Qualquer instrutor da turma pode fazer a chamada do período (a escala por aula continua disponível para restringir). Data/horário/sala desses períodos só mudam pela programação; um período com chamada lançada não pode deixar de existir. A presença para o certificado conta as aulas do grupo do aluno e as da turma inteira; aluno sem grupo em turma com grupos não é elegível.
62. **Modelos de programação** (`ScheduleTemplate`): a programação inteira (grupos, atividades com local e responsáveis, ordem de cada grupo e dia relativo) é copiada em JSON e aplicada numa turma sem atividades a partir de uma data. Sala/equipe/pessoa desativada ou inexistente fica de fora ao aplicar.

### Certificados: validação pública, vencimento e revogação (fechadas em 2026-10-07)
63. **Código de verificação por certificado** (`Certificate.code`): 12 caracteres aleatórios em base32 Crockford (sem I, L, O, U), impresso no PDF como `XXXX-XXXX-XXXX`. Aleatório e não sequencial de propósito: a validação é pública e mostra o nome do aluno, então o código não pode ser enumerável. A busca normaliza o que se digita (minúsculas, hífens, espaços, O→0, I/L→1). O QR do PDF passou a apontar para `/validar/:code` (este certificado), não mais para o crachá do aluno. `GET /public/certificates/:code` tem limite de 20 consultas por minuto por IP.
64. **Status efetivo**: um job (00h05, horário de Brasília) marca como `EXPIRED` os certificados com validade passada — antes nada marcava, e o filtro "Vencidos" ficava sempre vazio. Toda leitura (lista, "meus certificados", crachá, validação) usa o status efetivo, então um certificado vencido nunca aparece como "Válido" entre o vencimento e a rodada do job. Os crons do módulo passaram a usar `America/Sao_Paulo` (o servidor roda em UTC; o aviso "das 8h" saía às 5h).
65. **Revogação** (`certificates:manage`): exige motivo, guarda quem e quando; pode ser desfeita. O PDF continua existindo — quem confere a validade é a página pública, que mostra "revogado". O motivo não aparece publicamente.
66. **Lembretes de vencimento configuráveis por academia** (`CertificateReminderSettings`, tela Certificados → Lembretes): etapas antes do vencimento (padrão: 30 dias; 0 = no dia) e depois (e-mail próprio `CERTIFICATE_EXPIRED`), horário de envio, sugestão da próxima turma de reciclagem e resumo diário/semanal para pessoas escolhidas da academia (só pessoas cadastradas nela — sem contato externo de empresa/RH). Academia que nunca salvou mantém o comportamento anterior (um aviso 30 dias antes, às 8h). Vale a etapa mais recente alcançada: uma etapa que ficou para trás sem envio não é mandada atrasada; etapas "depois" têm até 7 dias de tolerância, para ligar "7 dias depois" não avisar quem venceu há anos.
67. **Cada lembrete é um registro** (`CertificateReminder`, único por certificado + etapa): é a trava contra reenvio (inclusive com duas instâncias rodando o cron) e o histórico mostrado por certificado. Só vira enviado quando o e-mail sai; falha é tentada de novo até 3 vezes. Antes, a deduplicação era a notificação in-app criada antes do e-mail — se o e-mail falhava, o aviso nunca mais saía. Quem já tem certificado mais novo e válido do mesmo curso (mesma categoria ou a turma de reciclagem indicada) não é lembrado. Envio manual ("Enviar lembrete agora") ignora as etapas, mas não vale para certificado revogado ou sem validade.

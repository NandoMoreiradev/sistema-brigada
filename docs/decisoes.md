# Decisões do projeto — Escola de Treinamento de Brigada e Segurança

> Nome do projeto ainda em aberto (pasta/repo temporariamente `brigada-treinamentos`). Base de código de referência: `maskotCrmEdu` (CRM/plataforma para escolas, NestJS + Prisma + React).

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

## Duas lacunas fechadas: conexão Google Calendar e critérios de certificado (2026-09-17)

Duas funcionalidades que já estavam prontas no backend/schema mas nunca tinham UI, encontradas ao revisar "o que falta" depois da validação:

1. **Conexão com o Google Calendar nunca tinha um botão em lugar nenhum.** O fluxo OAuth inteiro já existia no backend (`GET /user-integrations/google/auth`, `/status`, `/callback`, `DELETE .../google`), mas sem nenhuma tela pra clicar em "Conectar", ninguém nunca conectava a conta — o "Google Meet automático" (✅ na lista acima) nunca ativava de verdade. Criada a página "Minha Conta" (`/settings`, nav item novo em `MainLayout`) com o status da conexão e os botões conectar/desconectar. O callback do backend, que redirecionava para `/calendar` (rota que nunca existiu no frontend), passa a redirecionar para `/settings`. Validado: status inicial, URL de autorização bem formada (client_id/redirect_uri/scopes corretos), e o ciclo completo conectado→desconectado simulando a integração direto no banco (não dá pra testar o handshake OAuth real neste ambiente sandbox, sem credenciais Google de verdade).
2. **Critérios de emissão de certificado não tinham campo nenhum na tela.** `minAttendancePercent`, `requireAllLessonsWatched`, `recyclingValidityMonths` e `recommendedRecyclingCourseId` (decisões 17 e 19) já existiam no schema/API, mas o formulário de criar turma não tinha nenhum desses campos — e não existia *nenhuma* forma de editar uma turma depois de criada. Toda turma criada até agora recebia os defaults do Prisma (75% de presença, todas as aulas obrigatórias, sem validade) sem chance de ajustar. Adicionados os 4 campos no formulário de criação (`Courses.tsx`) e um botão "Editar critérios" novo em `CourseDetail.tsx` (só visível a quem tem `courses:manage`) com os mesmos campos. Validado criando e editando turma de verdade pela UI.

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

## Mapeamento de reaproveitamento (Maskot Edu → novo projeto)

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
- Nome definitivo do projeto/produto (e, por consequência, nome final da pasta/repo — hoje `brigada-treinamentos`).
- Layout de impressão do diploma (além do PDF gerado, algum requisito de gráfica/papel especial?).
- Terminologia final dos papéis do sistema no schema (`SUPER_ADMIN`, admin de academia, instrutor, aluno, staff/brigadista etc.) — resolver ao desenhar o schema Prisma.
- Refinar o catálogo de permissões (decisão 24) para granularidade por ação, se a equipe administrativa pedir.
- ~~Decisão 19 só está parcialmente implementada...~~ **✅ completa em 2026-09-17**: `DesignationsService.create` (`assertHasValidQualification`) agora bloqueia com 409 quando o staff só tem certificado de turma e/ou certificação externa vencidos (sem nenhuma qualificação válida no momento); quem nunca teve nenhuma das duas não é bloqueado. Achado à parte, não corrigido agora por estar fora do pedido: `Certificate.status` nunca é escrito como `EXPIRED` por nenhum job — a checagem de vencimento (aqui e em `notifyExpiringCertificates`) sempre compara `expiresAt` diretamente, então isso não afeta o bloqueio, mas o enum `EXPIRED` fica sem uso real hoje.

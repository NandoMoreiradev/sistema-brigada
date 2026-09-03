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
- ✅ Eventos polimórficos — assembleia/congresso/atuação de brigada/reunião, escala de staff, relatório de ocorrência, presença de reunião, **Google Meet automático** (pendência do mapeamento de reaproveitamento abaixo, já resolvida)
- ✅ Notificações reais — certificado emitido/vencendo (job diário + e-mail), designação, matrícula confirmada, sino no frontend
- ✅ Permissões granulares — **Fase 1**: catálogo de permissões + cargos (`RoleAssignment`) configuráveis por organização, tela `/roles` (ver decisões 22-24)

Pendente:

- ⏳ Permissões — **Fase 2**: endpoints "meus dados" (posse — turma que leciono, minha matrícula/certificado/escalação), necessários antes da Fase 3
- ⏳ Permissões — **Fase 3**: dashboards/portais dedicados de aluno e professor no frontend, consumindo a Fase 2
- ❌ App mobile (decisão 12) — não iniciado

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
| `UserSchoolAccess` + `RoleAssignment` + `Permission` + `SystemRole` | Cargo por unidade + papel de plataforma | Já resolve staff/instrutor com cargo diferente por filial | ✅ Fase 1 (cargo/permissão para equipe); posse de dado p/ aluno-professor é Fase 2 |
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
- Permissões granuladas + posse de dado para portal de aluno/professor — ver decisões 22-24. **⏳ Fase 1 (cargo/permissão) feita; Fase 2 (posse de dado) e Fase 3 (portal) pendentes.**
- App mobile novo (Expo/React Native), focado em staff/instrutor. **❌ não iniciado**

### Descartar
WhatsApp/Instagram/Messenger, chatbot de vendas, `EnrollmentCampaign` (é campanha de marketing, não matrícula), funil de leads, cupons/addons de SaaS, módulo financeiro completo (por enquanto).

## Próximos passos (ordem sugerida)
1. **Permissões — Fase 2**: endpoints "meus dados" (`/me/courses`, `/me/enrollments`, `/me/designations`, `/me/certificates`), checagem de posse nos services já existentes (instrutor só edita a própria turma, staff só confirma a própria designação), e `AuthService.getProfile` passa a devolver `studentProfile`/`staffMember`/`instructorCourseIds`.
2. **Permissões — Fase 3**: dashboards/portais dedicados de aluno e professor no frontend, consumindo a Fase 2.
3. **App mobile** (decisão 12): Expo/React Native, foco em staff/instrutor em campo (escala, presença, ocorrência).

## Itens menores em aberto (não bloqueiam a codificação)
- Nome definitivo do projeto/produto (e, por consequência, nome final da pasta/repo — hoje `brigada-treinamentos`).
- Layout de impressão do diploma (além do PDF gerado, algum requisito de gráfica/papel especial?).
- Terminologia final dos papéis do sistema no schema (`SUPER_ADMIN`, admin de academia, instrutor, aluno, staff/brigadista etc.) — resolver ao desenhar o schema Prisma.
- Refinar o catálogo de permissões (decisão 24) para granularidade por ação, se a equipe administrativa pedir.
- Decisão 19 só está parcialmente implementada: o **alerta de vencimento** existe (notificação + e-mail), mas o **bloqueio de designação de staff com certificado vencido** em evento de atuação ainda não foi construído (`DesignationsService.create` hoje não checa validade de certificado).

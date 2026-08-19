# Decisões do projeto — Escola de Treinamento de Brigada e Segurança

> Nome do projeto ainda em aberto (pasta/repo temporariamente `brigada-treinamentos`). Base de código de referência: `maskotCrmEdu` (CRM/plataforma para escolas, NestJS + Prisma + React).

## Contexto

Plataforma para uma escola de treinamento de brigada de incêndio e cursos de segurança (turmas, instrutores, alunos, eventos, certificados, crachás digitais), reaproveitando a stack e módulos maduros do Maskot Edu (auth, multiunidade/permissões, agenda, storage, vídeo-aulas), descartando o que é específico de CRM comercial (WhatsApp/Instagram, funil de vendas, chatbot, marketing).

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

## Mapeamento de reaproveitamento (Maskot Edu → novo projeto)

### Reaproveitar quase pronto
| Maskot Edu | Novo projeto | Observação |
|---|---|---|
| `School` (+ `isMatrix`/`parentSchoolId`) | `Academia` (tenant) | Renomear, manter hierarquia matriz→filiais |
| `AdminController` / `SchoolOperationsController` | Painel de plataforma (SUPER_ADMIN) | Gestão de academias-clientes, onboarding manual |
| `UserSchoolAccess` + `RoleAssignment` + `Permission` + `SystemRole` | Cargo por unidade + papel de plataforma | Já resolve staff/instrutor com cargo diferente por filial |
| Auth (JWT + refresh + 2FA) | Auth | Sem alteração |
| `Course`, `Student`, `Enrollment`, `TeacherCourseSubject`, `Room`, `TimetableEntry`, `ClassLog`, `Attendance` | `Turma`, `Aluno`, `Matricula`, designação instrutor↔turma, sala, grade horária, diário de aula, presença | Renomear, podar campos comerciais (`soldByUserId`, `churnScore`) |
| `TrainingModule`/`TrainingLesson`/`TrainingProgress` + upload presigned R2 | Vídeo-aulas por turma | Hoje é global/interno da Maskot; passa a ser por turma + gated por matrícula |
| `StudentsService.enrollStudent()` | Fluxo de matrícula | Remover parte de `Lead`/financeiro |
| `UserAvailability` + `TimeOff` + `ScheduleSettings` + `EventType` + `Visit` + Google Calendar OAuth | Agenda de reuniões periódicas | Falta só `conferenceDataVersion` na chamada do Google para gerar link de Meet automático |
| `notifications/` + push (web/mobile) | Alertas de vencimento de certificado | Direto |

### Construir do zero
- `Event` genérico polimórfico (tronco + tabelas-filhas por tipo) — ver decisão 2.
- Certificado/Diploma: model com validade, template por academia, critérios configuráveis por turma, geração de PDF (inspirar no padrão `jsPDF` existente, mas provavelmente server-side).
- Crachá digital + QR de validação pública: reaproveitar a técnica de QR (hoje usada só em 2FA) e o padrão de link público com token/expiração do módulo Drive (`SharedLink`).
- Staff/membro de equipe: papel adicional sobre `User` (não entidade separada) — ver decisões 6-9.
- Designação com escala/turnos dentro de evento de atuação.
- Relatório de ocorrência generalizado (hoje `StudentOccurrence` é só por aluno; precisa aceitar vínculo a `Event` também).
- App mobile novo (Expo/React Native), focado em staff/instrutor.

### Descartar
WhatsApp/Instagram/Messenger, chatbot de vendas, `EnrollmentCampaign` (é campanha de marketing, não matrícula), funil de leads, cupons/addons de SaaS, módulo financeiro completo (por enquanto).

## Itens menores em aberto (não bloqueiam o início da codificação)
- Nome definitivo do projeto/produto (e, por consequência, nome final da pasta/repo — hoje `brigada-treinamentos`).
- Layout de impressão do diploma (além do PDF gerado, algum requisito de gráfica/papel especial?).
- Terminologia final dos papéis do sistema no schema (`SUPER_ADMIN`, admin de academia, instrutor, aluno, staff/brigadista etc.) — resolver ao desenhar o schema Prisma.

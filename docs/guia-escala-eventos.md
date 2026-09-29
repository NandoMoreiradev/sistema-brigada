# Guia rápido — Escala e Mapa de eventos (congressos e assembleias)

Para quem monta e acompanha a escala do evento. Vale para eventos de vários dias.

## A ideia em 30 segundos
1. **Turnos** (ex.: Manhã 08:00–12:00, Tarde 12:00–18:00) são criados **uma vez por evento** e valem para **todos os postos**.
2. **Postos** são os locais no mapa (Portão A, Palco, Enfermaria…) e dizem **quantas pessoas precisam**.
3. **Escalar** é escolher **pessoas + turnos + posto**. Quem trabalha manhã num dia, o dia todo em outro e só à tarde no terceiro simplesmente recebe turnos diferentes em cada dia.
4. Tudo que você vê depois (lista, cobertura, mapa, texto, impressão) sai **dos mesmos dados**, então nunca se contradizem.

## Passo a passo

### 1. Criar os turnos (aba **Escala → Turnos**, ou **Mapa → ⋯ → Gerenciar turnos**)
- Marque os **dias** do evento e defina os **modelos** de turno (Manhã, Tarde, Noite…). Clique em **Criar**: cada modelo é repetido em cada dia.
- Turno que passa da meia-noite (Noite 22:00–02:00): coloque o fim menor que o início.
- Para **remarcar** um turno, edite o horário e salve: a escala de todo mundo nele é remarcada. Se alguém ficar em conflito com outro evento, o sistema avisa e não salva.
- Só dá para **excluir** um turno que ninguém está usando.
- A tela avisa **lacuna** (nenhum posto coberto entre um turno e o seguinte) e **sobreposição** (passagem de turno). O ideal é os turnos **encostarem** (12:00 → 12:00).

### 2. Cadastrar os postos (aba **Mapa**)
- Envie a **planta baixa**. Se o local tem **várias áreas ou andares funcionando ao mesmo tempo** (térreo, mezanino, externa), cadastre uma planta para cada uma em **⋯ → Plantas do evento** (até 10; a partir da segunda o **nome é obrigatório**). Cada posto pertence a **uma só planta**; se um local precisa aparecer em duas, cadastre dois postos.
- Com mais de uma planta, aparecem **abas de planta** acima do dia/turno. Um aviso laranja na aba mostra quantos postos estão **sem ninguém** naquele turno. Para levar um posto a outra planta: clique no pino → **Mover para outra planta** (ele volta ao centro: arraste para o lugar certo). Não dá para excluir planta que ainda tem postos.
- **Adicionar posto** → clique no local da planta → dê o nome e **quantas pessoas o posto precisa**.
- Arraste o pino para reposicionar. Clique no pino para renomear, ajustar a quantidade ou remover.

### 3. Escalar (aba **Escala → Nova designação**)
- Marque as **pessoas**, a **função**, os **turnos** (pode marcar vários, inclusive "dia todo") e o **posto**.
- O resumo mostra "pessoas × turnos = designações". Cada pessoa recebe **um** aviso, mesmo escalada em vários turnos.
- Atalho: na **Cobertura**, clique numa célula (posto × turno) e o formulário já abre com aquele turno e posto.
- Não deixa escalar a mesma pessoa em turnos que se sobrepõem, nem quem está com o certificado vencido.

### 4. Acompanhar (aba **Escala**)
- Alterne entre **Lista** e **Cobertura** no controle no topo da aba.
- **Lista**: quem está onde. A **situação** (pendente, confirmada, recusada) é uma etiqueta que se altera com um toque. O menu **⋯** de cada linha tem **Editar** e **Remover**. Filtre por dia (só aparece se o evento tem mais de um dia) e por situação.
- **Cobertura** (postos × turnos): 🟥 vermelho = sem ninguém · 🟨 amarelo = parcial · 🟩 verde = completo · 🟪 roxo = acima do necessário. É a melhor tela para achar buracos. `*` = ainda não confirmou.

### 5. Mapa (aba **Mapa**)
- Escolha o **dia** e o **turno**: o mapa mostra **só aquele turno**, com os **nomes em cada posto**. **Dia todo** mostra um resumo por turno.
- O número no pino é "escalados/necessários". **Nomes no mapa** e **Mostrar funções** ligam/desligam os detalhes.
- **Exportar ▾ → Baixar imagem (PNG)**: o que está na tela (a planta da aba aberta), com cabeçalho (dia e turno), legenda e hora em que foi gerado.
- **Exportar ▾ → Imprimir mapas**: escolha os turnos; sai **uma folha A4 paisagem por turno** (e **por planta**, se houver mais de uma: escolha as plantas e os turnos).
- **Exibir ▾**: liga/desliga *Nomes no mapa* e *Mostrar funções*.
- Em tela estreita (iPad em pé) o mapa rola na horizontal para os nomes continuarem legíveis.

### 6. Enviar a escala (aba **Escala → Exportar ▾**)
- **Copiar para o grupo**: a escala inteira (dia → turno → posto → pessoas; com várias plantas, os postos vêm agrupados por planta), pronta para colar no WhatsApp. Marque quais turnos entram. Opcional: listar postos sem ninguém.
- **Copiar por pessoa**: só os turnos daquela pessoa, com saudação. Escolha a pessoa e copie; **Copiar de todos** junta todos os textos separados por linhas.
- **Imprimir lista**: uma página por dia, com os turnos e postos.
- O evento em si: **Editar evento** fica visível; **Excluir evento** fica no menu **⋯** do cabeçalho, com confirmação.

## Regras que valem para todas as saídas
- **Quem recusou não aparece em lugar nenhum** (nem conta vaga). Se recusar, o horário fica livre para outro evento.
- **Pendente aparece marcado** (`*` ou "pendente") até confirmar.
- Toda impressão e imagem traz **"gerada em"**: antes de usar uma folha, confira se é a mais recente.
- Depois de qualquer mudança na escala, **gere de novo** o texto/impressão.

## Perguntas frequentes
- **Preciso de posto para escalar?** Não, mas a pessoa aparece como "Sem posto" e não aparece no mapa.
- **Um posto precisa de menos gente em um dia?** A quantidade é por posto (igual em todos os turnos). Se um posto não é usado num turno, ele aparece como "sem ninguém" nesse turno.
- **Migrei um evento antigo. E agora?** As escalas antigas foram agrupadas em turnos com nome provisório (ex.: "08:00–12:00"). Renomeie para "Manhã" etc. em **Turnos**.
- **Quem pode fazer o quê?** Criar/editar turnos, postos e escala exige a permissão de gestão de eventos. Os demais só veem (lista, cobertura, mapa) e cada pessoa confirma ou recusa a própria escala.

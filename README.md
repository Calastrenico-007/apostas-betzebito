# Betzebi Sportsbook — Plataforma de Apostas com Operação Manual

Este repositório reúne projetos desenvolvidos durante as férias; a aplicação atualmente documentada aqui é a Betzebi.

> **Não pronto para operação pública ou comercial.** Depósitos e levantamentos são manuais e dependem de confirmação do operador. Este repositório não contém integração verificada com um provedor de pagamentos, feed desportivo, licença, termos legais ou processo de conformidade. Não aceite dinheiro nem abra o acesso público antes de validar esses requisitos com profissionais e entidades competentes.

Aplicação web premium estilo sportsbook internacional (tema escuro, verde-esmeralda/menta e dourado), concebida para mobile e desktop:

- **Identidade Betzebi**: Visual sério, sóbrio e moderno inspirado nas melhores casas de apostas desportivas reais.
- **Contas & Saldo**: Saldo apresentado em MT; alterações são registadas no extrato e atualizadas via Supabase Realtime.
- **Contas**: Autenticação por e-mail e palavra-passe; contas não administradoras ficam pendentes até aprovação manual.
- **Carteira & Gestão de Saldo**: Pedido de depósito após transferência manual e-Mola; o utilizador informa o nome do titular da conta e a referência, e o operador confere o recebimento antes de creditar. Levantamentos são pagos manualmente e concluídos pelo operador.
- **Fechamento Automático por Início do Jogo**: As apostas pré-jogo encerram automaticamente quando o pontapé de saída (`starts_at`) é atingido, impedindo apostas fora de tempo.
- **Futebol & Mercados**: Geração de mercados principais (1X2, Dupla Hipótese, Mais/Menos Golos 1.5/2.5/3.5, Ambas Marcam, Resultado ao Intervalo).
- **Boletim de Apostas**: Simples e múltiplas com odds bloqueadas, bónus configurável nas odds de múltiplas, retenção sobre o retorno bruto configurável e estimativa do retorno líquido.
- **Painel de Administração Completo (`/admin`)**:
  - Criar e gerir partidas de futebol e definir cotações.
  - Painel ao vivo: marcador dinâmico, controlo de minuto, suspensão emergencial de mercados e reabertura.
  - Liquidação de resultados com cálculo e crédito imediato dos prémios aos vencedores (`settle_football`).
  - Gestão de utilizadores e aprovação manual de depósitos/levantamentos de carteira.
  - Ajuste manual de saldos com auditoria de motivo.
- **Painel de ecrã (`/telao`)**: Interface para ecrã grande com ranking, jogos e atividade da plataforma.
- **Tempo Real (Supabase Realtime)**: Cotações, placares e saldos atualizados instantaneamente via WebSockets.

Tecnologias: **Next.js 14** (App Router, TypeScript) · **Tailwind CSS** · **Supabase** (Postgres 15, RLS, RPCs atómicas, Realtime).

---

## 1. O que precisas

- Uma conta **GitHub** (grátis) — https://github.com
- Uma conta **Supabase** (grátis) — https://supabase.com
- Uma conta **Vercel** (grátis, entra com o GitHub) — https://vercel.com
- Só para correr no PC: **Node.js 18 ou mais recente** (https://nodejs.org, versão LTS).

Dá para fazer tudo **só com o telemóvel Android** (passos 2 → 6, usando o browser Chrome em "modo computador" quando o ecrã for apertado).

---

## 2. Criar o projeto Supabase

1. Entra em https://supabase.com/dashboard → **New project**.
2. Escolhe um nome (ex.: `feirabet`), cria uma **password da base de dados** (guarda-a) e a região mais próxima
   (ex.: _West EU_ ou _South Africa_ se aparecer). Clica **Create new project** e espera 1–2 minutos.

## 3. Criar as tabelas (executar o `schema.sql`)

1. No menu da esquerda: **SQL Editor** → **New query**.
2. Abre o ficheiro `supabase/schema.sql` deste projeto, **copia todo o conteúdo** e cola no editor.
3. Clica **Run**. Deve aparecer _Success. No rows returned_.

Isto cria as tabelas, políticas RLS, funções e configuração Realtime. **Não cria partidas, odds, saldos de teste ou eventos de exemplo**. Adiciona apenas jogos, horários e odds verificados por uma fonte autorizada, através do painel admin.

> ⚠️ O `schema.sql` começa por apagar e recriar tabelas e funções. Executa-o uma única vez apenas num projeto Supabase vazio. **Nunca o voltes a executar num projeto com dados**: podes apagar contas, apostas, saldos e histórico. Para atualizações, cria e revê migrações não destrutivas.

Se a base já foi criada com uma versão anterior do schema, **não voltes a executar `schema.sql`**. Executa `supabase/migrations/20261009_email_password_auth.sql` no SQL Editor para retirar os bloqueios antigos de KYC.

Para bases já existentes, executa também `supabase/migrations/20261009_security_set_odds.sql` para restringir a alteração de cotações a administradores autenticados, `supabase/migrations/20261009_manual_account_approval.sql` para ativar aprovação manual de contas, `supabase/migrations/20261009_operator_credit_pool.sql` para limitar os créditos manuais ao fundo definido pelo operador, `supabase/migrations/20261009_wallet_account_holder_name.sql` para guardar o nome do titular E-Mola em cada pedido de carteira, e `supabase/migrations/20261009_bet_bonus_and_tax_settings.sql` para configurar a retenção e o bónus nas odds de múltiplas.

No painel **Admin → Utilizadores & Carteira**, define o dinheiro próprio realmente reservado para ajustes manuais. O fundo começa em **0 MT**; créditos administrativos acima do disponível são recusados. Depósitos só são creditados depois de confirmares o recebimento real de e-Mola. Este limite controla ajustes manuais, não calcula a exposição total nem garante fundos para prémios de apostas.

## 4. Configurar o login por email

1. Menu **Authentication** → **Sign In / Providers** (em versões antigas: _Providers_) → **Email**.
2. Confirma que **Enable Email provider** está ligado.
3. Para usar aprovação manual no lugar de confirmação de email, desativa **Confirm email** nas opções do provedor. Isto permite iniciar sessão sem verificar a propriedade do endereço; usa um processo seguro para contactar utilizadores e recuperar contas.
4. Mantém as outras proteções de autenticação e recuperação de conta. A aprovação do administrador não verifica automaticamente identidade nem idade; essas verificações, quando exigidas, precisam de ser feitas separadamente.

## 5. Copiar as chaves

1. Menu **Project Settings** (roda dentada) → **API** (ou **Data API** / **API Keys**).
2. Copia:
   - **Project URL** → ex.: `https://abcdefgh.supabase.co`
   - **anon public key** (em projetos novos pode estar no separador _Legacy API keys_, ou usa a **Publishable key** `sb_publishable_...`, que também funciona).
3. **Nunca** uses nem publiques a chave `service_role` / _secret_ — a app não precisa dela.

Estas duas chaves vão ser as variáveis de ambiente:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...   (ou sb_publishable_...)
```

## 6. Publicar na Vercel (a partir do GitHub)

### 6.1 Pôr o código no GitHub

- **No PC:** cria um repositório novo em https://github.com/new (ex.: `feirabet`), depois na pasta do projeto:
  ```bash
  git init
  git add .
  git commit -m "FeiraBet"
  git branch -M main
  git remote add origin https://github.com/O-TEU-UTILIZADOR/feirabet.git
  git push -u origin main
  ```
- **Só com Android:** cria o repositório no site do GitHub → **Add file → Upload files** → descompacta o zip
  (com a app _Ficheiros_/ZArchiver) e envia as pastas e ficheiros (**não envies** `node_modules` nem `.next`).

### 6.2 Importar na Vercel

1. Entra em https://vercel.com → **Add New… → Project** → escolhe o repositório → **Import**.
2. Em **Environment Variables**, configura as chaves do Supabase e os dados reais de recebimento e-Mola que serão exibidos ao utilizador: `NEXT_PUBLIC_EMOLA_NUMBER` e `NEXT_PUBLIC_EMOLA_MERCHANT_NAME`. Não coloques credenciais secretas em variáveis `NEXT_PUBLIC_*`.
3. Mantém as credenciais secretas apenas no ambiente de servidor. Protege o Preview com Deployment Protection; não uses `vercel --prod` nem partilhes um link público antes da revisão completa.
4. Para usar aprovação manual como controlo de acesso, desativa **Confirm email** no provedor Email. Configura a URL do Preview em **Supabase → Authentication → URL Configuration** e testa cadastro, conta pendente, aprovação admin, pedido financeiro, atualização do saldo e levantamento.

> Se mudares as variáveis depois, faz **Deployments → ⋯ → Redeploy** para aplicar. As variáveis `NEXT_PUBLIC_*` são incluídas no frontend publicado; usa nelas apenas dados de recebimento destinados a serem vistos pelos utilizadores.

**Alternativa (Vercel CLI no PC):**

```bash
npm i -g vercel
vercel            # responde às perguntas
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel
```

O primeiro deploy deve ser um Preview protegido. Só promove para produção depois de validar o fluxo ponta a ponta e restringir o acesso à aplicação.

(Opcional) No Supabase: **Authentication → URL Configuration → Site URL** = o teu link da Vercel.
Configura os endereços permitidos para autenticação no URL da Vercel, mesmo com confirmação de email desativada.

## 7. Tornar-te administrador

1. Abre a app (link da Vercel) e **cria a tua conta** em _Registar_.
2. No Supabase, **SQL Editor** → nova query:
   ```sql
   update public.profiles set role = 'admin' where email = 'o-teu-email@exemplo.com';
   ```
3. Clica **Run**, volta à app e **recarrega a página**. Aparece o botão **Admin** (ou vai a `/admin`).

Para adicionar outro admin, repete o passo 2 com o email dessa pessoa.

## 8. Correr no computador (desenvolvimento)

```bash
npm install
cp .env.example .env.local     # no Windows: copy .env.example .env.local
# edita .env.local e cola o URL e a anon key
npm run dev
```

Abre http://localhost:3000. Para testar no telemóvel na mesma rede Wi-Fi: `http://IP-DO-PC:3000`.

Outros comandos: `npm run build` (compila para produção) · `npm start` (corre a versão compilada) · `npm run typecheck`.

---

## 9. Operação de administração

**Admin (`/admin`):**

- **Jogos** → _Criar jogo_ (casa, fora, liga, hora). Abre o jogo e escreve as odds de cada mercado → _Guardar alterações_.
- Quando o jogo começa: **● Ao vivo**. Num golo: **🔒 Suspender todos**, atualiza o **placar/minuto**, ajusta odds e **▶ Reabrir todos**.
  Também podes suspender/reabrir um mercado só.
- No fim: escreve o **resultado final** (e o do **intervalo**) → _Confirmar resultado e liquidar_. Todos os mercados e apostas são pagos.
  Se não meteres o intervalo, o mercado "Resultado ao Intervalo" é **anulado** (reembolso / odd 1 nas múltiplas).
- **Eventos** → cria perguntas com odds fixas ou apostas mútuas; **Fechar apostas** quando quiseres; no fim escolhe a **opção vencedora**
  ou **Anular** (reembolsa todos).
- **Propostas** → eventos sugeridos pelos visitantes: _Editar / odds_, _Aprovar_ ou _Rejeitar_.
- **Utilizadores** → pesquisar contas, ver saldos e processar pedidos de carteira.
- **Taxas & Bónus** → definir a retenção percentual sobre o retorno total e o aumento das odds para múltiplas a partir de um número de seleções. A predefinição é 0% de retenção e +4% nas odds a partir de 5 seleções. As alterações só afetam apostas registadas depois de guardar; confirma qualquer taxa aplicável com um profissional local.

**Telão:** abre `https://o-teu-link/telao` num ecrã ligado à TV/projetor. Confirma que apenas informação verificada e apropriada aparece antes de a apresentar publicamente.

Para depósitos manuais, o utilizador transfere primeiro e informa o valor e a referência real. O admin verifica o recebimento diretamente na conta antes de aprovar; só a aprovação credita o saldo. Para levantamentos, o admin confirma os dados do destinatário, efetua o pagamento fora da plataforma e só então conclui o pedido.

---

## 10. Regras do sistema (resumo técnico)

| Regra                                                                                                                            | Onde                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Novo perfil começa com saldo zero                                                                                                 | trigger `on_auth_user_created` → `handle_new_user()`                                |
| Mercados de futebol automáticos                                                                                                  | trigger `events_generate_markets`                                                   |
| Aposta atómica (saldo, mercado aberto, evento aberto, snapshot das odds e das regras de taxa/bónus)                              | `place_bet`                                                                         |
| 1 seleção = simples; 2+ = múltipla (odds multiplicadas, nunca 2 do mesmo evento, máx. 15); bónus ajusta a odd total             | `place_bet`, `bet_settings`                                                          |
| Retenção configurável no retorno total de ganhos e cash-outs (inclui aposta e bónus); o saldo recebe o valor líquido              | `admin_set_bet_rules`, `_try_settle_bet`, `_settle_market`, `cashout_bet`           |
| Apostas mútuas: só simples; bolo × (1 − comissão 5%) ÷ bolo da opção vencedora; se ninguém acertar, reembolso                    | `_settle_market`                                                                    |
| Liquidação de futebol a partir do resultado                                                                                      | `settle_football(evento, golos_casa, golos_fora, int_casa, int_fora)`               |
| Liquidação de evento especial                                                                                                    | `settle_special(evento, opção_vencedora)`                                           |
| Anular (reembolso; em múltiplas a perna anulada conta odd 1)                                                                     | `void_event(evento)`                                                                |
| Múltiplas: perdem se qualquer perna perder; pagam quando todas estiverem resolvidas                                              | `_try_settle_bet`                                                                   |
| Cash-out = aposta × odd_colocação ÷ odd_atual × 0,9 (máx. 95% do retorno potencial), só simples de odds fixas com mercado aberto | `cashout_bet(aposta)`                                                               |
| Ajuste de saldo pelo admin                                                                                                       | `admin_adjust_balance(user, valor, motivo)`                                         |
| Propor / criar evento (admin publica logo; utilizador fica pendente, máx. 5 pendentes)                                           | `create_special_event(...)`, `approve_event`, `reject_event`                        |
| Ranking (exclui admins)                                                                                                          | `get_leaderboard('balance' \| 'profit', limite)`                                    |

**Segurança (RLS):** cada utilizador só vê o seu perfil, apostas e transações. O saldo e o papel (`role`) **não podem ser alterados**
pelo utilizador (só o nome); alterações de saldo passam por funções `SECURITY DEFINER` que validam o operador e o pedido.
Só admins criam/editam jogos, mercados e odds. Eventos pendentes só são visíveis ao autor e aos admins.

**Realtime:** tabelas `events`, `markets`, `selections`, `profiles`, `bets`, `activity` estão na publicação `supabase_realtime`
(o script trata disso). Confirma em **Database → Publications** se algo não atualizar.

---

## 11. Estrutura

```
supabase/schema.sql          Esquema base (tabelas, RLS, funções, triggers e realtime; destrutivo, sem dados de exemplo)
src/middleware.ts            Renova a sessão Supabase (cookies)
src/lib/                     Cliente Supabase, tipos, formatação (pt-PT, fuso Africa/Maputo), hooks realtime, cash-out
src/components/              AppShell (cabeçalho, navegação, rodapé 18+), Boletim, cartões de jogos/eventos, botões de odds
src/components/admin/        Editor de mercados/odds
src/app/                     Páginas:
  /                          Início (ao vivo, futebol, eventos)
  /jogo/[id]                 Todos os mercados de um jogo
  /eventos, /eventos/propor  Eventos ao Vivo e propostas
  /apostas                   Minhas apostas (abertas/resolvidas + cash-out)
  /carteira (= /depositar)   Saldo, pedidos manuais, histórico, perfil
  /ranking                   Classificação por saldo e por lucro
  /telao                     Ecrã grande do stand
  /login, /registar
  /admin/...                 Painel, jogos, eventos, propostas, utilizadores
```

## 12. Problemas comuns

- **"Supabase não configurado"** → faltam as variáveis de ambiente (ou não fizeste _Redeploy_ depois de as adicionar).
- **Conta permanece pendente** → aprova-a em `/admin/utilizadores` depois da análise manual.
- **Não aparece o botão Admin** → corre o `update ... role = 'admin'` com o email exato e recarrega a página.
- **Odds não atualizam sozinhas** → verifica _Database → Publications → supabase_realtime_ (as 6 tabelas devem estar lá).
- **Erro ao apagar jogo** → já tem apostas; usa **Anular jogo**.
- **Projeto Supabase pausado** → verifica o estado e o plano no dashboard do Supabase.

## 13. Limitações e pré-requisitos para lançamento

- A autenticação por e-mail/senha não verifica identidade nem idade. O cadastro inclui apenas uma declaração do utilizador e não substitui os controlos exigidos por lei.
- Com a migração de aprovação manual aplicada, contas novas e contas existentes não administradoras ficam pendentes. O administrador pode aprovar, rejeitar ou voltar a pendente; contas não aprovadas não podem apostar, propor eventos nem criar pedidos de carteira.
- Campos antigos de KYC são mantidos no banco por compatibilidade e para não apagar dados pessoais existentes automaticamente; deixa de ser feita nova recolha. Define e executa uma política de retenção/apagamento adequada para dados já guardados.
- Depósitos e levantamentos são operações manuais. A app não confirma pagamentos junto do e-Mola; o operador tem de conferir cada movimento fora da plataforma.
- Não existe feed desportivo integrado: resultados, minuto e placar ao vivo são inseridos manualmente. Odds e calendário não devem ser apresentados como dados atuais até serem verificados e atualizados por um responsável autorizado.
- O cash-out só existe para **apostas simples de odds fixas** (não para múltiplas nem mútuas).
- Antes de qualquer lançamento, valida a autorização legal aplicável, idade mínima, regras dos meios de pagamento, proteção de dados, termos, jogo responsável, suporte e procedimentos de reconciliação.

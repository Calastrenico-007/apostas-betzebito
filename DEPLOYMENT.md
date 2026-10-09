# Deployment handoff — Betzebi

> This project is not cleared for public or commercial betting. Confirm local licensing, age restrictions, privacy and consumer-protection requirements, provider authorization, operational controls, and independent security review before accepting users or money.

## 1. Prerequisites

- Supabase project created
- Vercel project linked to this repo
- Node.js 18+ installed locally
- Access to the Supabase dashboard

## 2. Supabase setup

1. Create a new, empty Supabase project.
2. Review `supabase/schema.sql`; it is destructive and drops existing tables. Run it only once against an empty project. It creates no events or example data.
3. For an existing database created with the previous schema, run `supabase/migrations/20261009_email_password_auth.sql`, `supabase/migrations/20261009_security_set_odds.sql`, `supabase/migrations/20261009_manual_account_approval.sql`, `supabase/migrations/20261009_operator_credit_pool.sql`, `supabase/migrations/20261009_wallet_account_holder_name.sql`, and `supabase/migrations/20261009_bet_bonus_and_tax_settings.sql` in SQL Editor; do not rerun the destructive schema.
4. Go to Authentication > Providers > Email. To replace email confirmation with manual account approval, disable Confirm email. New signups then receive a session but remain pending until an admin approves them.
5. Manual admin approval does not independently verify identity or age. Perform any legally required checks separately before approving a user.
6. Go to Authentication > URL Configuration and set the deployment URL to your Vercel domain.
7. Check Database > Publications and ensure the lists include the tables used by realtime updates.
8. In Admin > Users & Wallet, set the operator credit pool only to funds actually reserved for manual balance adjustments. The pool starts at zero and limits manual admin credits; it does not model total betting exposure or guarantee winnings coverage.
9. In Admin > Taxas & Bónus, review the 0% default retention and +4% odds bonus for multiples with at least 5 selections. The operator can change both settings and the selection threshold. Retention applies to the full gross amount paid for wins and cash-outs (including the stake and any bonus), and each bet snapshots the settings at placement. Confirm any applicable rate with a qualified local professional; the app does not determine legal tax obligations.

## 3. Environment variables

Create a local `.env` file from `.env.example` and supply real values before a protected staging deployment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_EMOLA_NUMBER=
NEXT_PUBLIC_EMOLA_MERCHANT_NAME=
EMOLA_API_URL=
EMOLA_MERCHANT_ID=
EMOLA_API_KEY=
```

Never expose the service-role key or payment API credentials in browser code or `NEXT_PUBLIC_*` variables. The `NEXT_PUBLIC_*` receiving details are public and must be authorized business details, not placeholders.

## 4. Vercel deploy

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Configure all environment variables in Vercel for the intended environment.
4. Enable deployment protection for Preview and test using a dedicated non-production project.
5. Do not promote to production until compliance, credentials, database policies, authentication, and financial flows have been independently reviewed.

## 5. Admin access

After creating the first user:

```sql
update public.profiles
set role = 'admin'
where email = 'seu-email@exemplo.com';
```

Then refresh the app and open `/admin`. Review account requests under `/admin/utilizadores`; unapproved accounts cannot place bets, submit event proposals, or create wallet requests.

## 6. Operational smoke test

Run locally:

```bash
npm install
npm run build
npm run dev
```

Then verify:

- sign up with email/password while email confirmation is disabled
- verify the new account stays pending and cannot place bets or make wallet requests
- approve the account in `/admin/utilizadores` and verify betting and wallet requests become available
- user submits wallet request
- verify the e-Mola account-holder name and transaction reference shown in the admin request
- admin confirms the real e-Mola transfer before approving the request
- create a match in `/admin/jogos`
- enter verified event data and odds
- place a bet from the user session
- settle the result from `/admin/jogos/[id]`
- verify the bet slip shows the gross return, configured retention and net return
- test a multiple at and above the configured selection threshold, then confirm the odds bonus is applied only at/above the threshold
- confirm the settled user's balance receives the net return and the bet history records any retention

## 7. Current product limitations

- Deposits and withdrawals are manual; the application does not independently verify provider transactions.
- Email/password authentication does not verify identity or age. The age checkbox is a self-declaration, not an independent check.
- Previous KYC columns and notes are retained in the database; the application no longer collects or displays them. Apply an appropriate retention/deletion policy separately.
- There is no live sports data provider. Admins enter and maintain event information manually.
- Betting closes automatically when a match `starts_at` is reached; the correctness of that timestamp depends on the operator.
- The SQL schema contains no seed data and is destructive if re-run.

This project was validated in the local environment on 2026-10-09 before handoff.

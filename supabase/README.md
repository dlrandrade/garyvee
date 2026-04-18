# Supabase Setup (Gary Vee Reader)

## 1) Schema
Execute [`supabase/schema.sql`](./schema.sql) no SQL Editor do projeto Supabase.

## 2) Chaves no frontend
O app usa apenas a chave publica (`anon`) no cliente:

- URL: `https://uxwzcoemwgwrtymsahxl.supabase.co`
- Key: anon public JWT

A chave `service_role` **nao deve** ficar no frontend.

## 3) Usuario padrao de acesso rapido
Credenciais esperadas pela tela:

- Email: `dlrandrade@gmail.com`
- Senha: `190221`

Se a conta ainda nao existir, crie pelo painel Auth ou via Admin API (service role) fora do frontend.

## 4) Dados persistidos no banco
- `reader_state`: snapshot completo da jornada (XP, capitulos, logs, estado local)
- `reading_progress`: conclusao de capitulos
- `flashcard_progress`: fixacao dos cards
- `share_exports`: historico de posts gerados (story/feed e insight/tool)

## 5) Fluxo de seguranca
- RLS ativa em todas as tabelas.
- Cada usuario acessa apenas suas linhas (`auth.uid() = user_id`).

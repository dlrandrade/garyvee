# Supabase Setup (Gary Vee Reader)

## 1) Schema
Execute [`supabase/schema.sql`](./schema.sql) no SQL Editor do projeto Supabase.

## 2) Chaves no frontend
O app usa apenas a chave publica (`anon`) no cliente:

- URL: `https://uxwzcoemwgwrtymsahxl.supabase.co`
- Key: anon public JWT

A chave `service_role` **nao deve** ficar no frontend.

## 3) Conta inicial
Crie a primeira conta de acesso diretamente pelo painel Auth do Supabase (ou por Admin API no backend). Nao exponha credenciais no frontend.

## 4) Dados persistidos no banco
- `reader_state`: snapshot completo da jornada (XP, capitulos, logs, estado local)
- `reading_progress`: conclusao de capitulos
- `flashcard_progress`: fixacao dos cards
- `share_exports`: historico de posts gerados (story/feed e insight/tool)
  - Inclui tambem export de progresso (`post_variant = progress`)

## 5) Fluxo de seguranca
- RLS ativa em todas as tabelas.
- Cada usuario acessa apenas suas linhas (`auth.uid() = user_id`).

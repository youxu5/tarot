-- ============================================================
-- 翠玉录塔罗 · Supabase 权限收紧脚本
-- 用法：Supabase → 左侧 SQL Editor → New query → 整段粘贴 → Run
-- 作用：把「全世界可读可写」改成「全世界只能读，写入必须过云函数且带口令」
-- 前提：表 public.cuiyu_slots 已经建好（没建过就先跑文件末尾那段建表）
-- ============================================================

-- 1) 先撤掉公开角色的全部权限（含之前给的 insert/update/delete）
revoke all on public.cuiyu_slots from anon;
revoke all on public.cuiyu_slots from authenticated;

-- 2) 只把「读」还回去：访客能看图，别的什么都做不了
grant select on public.cuiyu_slots to anon;
grant select on public.cuiyu_slots to authenticated;

-- 3) 策略：从「对所有人全开」改成「对所有人只读」
--    先把这张表上所有旧策略通通删掉（不按名字一个个点名，防止有漏网的写策略），
--    再只建一条 SELECT —— 这样无论以前叫什么名，都不会留下能写的口子。
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'cuiyu_slots'
  loop
    execute format('drop policy if exists %I on public.cuiyu_slots', r.policyname);
  end loop;
end $$;

create policy cuiyu_slots_read on public.cuiyu_slots
  for select
  to anon, authenticated
  using (true);

-- 4) 云函数用的角色：service_role（它绕过 RLS，所以必须显式给表权限）
grant select, insert, update, delete on public.cuiyu_slots to service_role;

-- 5) 自检：跑完这条应该只剩一条 cmd='SELECT' 的策略
-- select policyname, cmd from pg_policies where tablename = 'cuiyu_slots';

-- ============================================================
-- 执行完这一步之后：
--   · 访客手里只有 anon key —— 只能读，改不动任何数据；
--   · 唯一的写入通道是云函数 cuiyu-write，它在服务端拿 service_role 写；
--   · 云函数只认 CUIYU_PASSCODE 这个口令，口令存在 Supabase 的 Secrets 里，
--     不写进任何会被下载的文件 —— 前端源码里翻不到它。
-- ============================================================

-- ============================================================
-- 附：表还没建的话，先单独跑这一段（已建过就跳过）
-- ============================================================
-- create table if not exists public.cuiyu_slots (
--   id         bigint generated always as identity primary key,
--   page       text        not null,
--   key        text        not null,
--   ix         int         not null default 0,
--   url        text        not null,
--   rev        bigint      not null default 0,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz
-- );
-- create unique index if not exists cuiyu_slots_slot_uidx
--   on public.cuiyu_slots (page, key, ix);
-- alter table public.cuiyu_slots enable row level security;

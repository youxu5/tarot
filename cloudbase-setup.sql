-- ============================================================
-- 翠玉录塔罗 · CloudBase PostgreSQL 初始化脚本
-- 用法：控制台 → PostgreSQL → SQL 查询，整段粘贴执行一次即可
-- 作用：建表 + 放开匿名(anon)读写权限（写操作受页面 520 口令保护）
-- ============================================================

create table if not exists public.cuiyu_slots (
  id         bigserial primary key,
  page       text not null,
  key        text not null,
  ix         int  not null default 0,
  url        text not null,                      -- 图片 data URL（压缩后约 200~400KB）
  rev        bigint not null default 0,          -- 版本号（时间戳），用于判断哪张更新
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 同一槽位只留一条（page+key+ix 唯一），避免历史行越积越多
create unique index if not exists cuiyu_slots_slot_uidx
  on public.cuiyu_slots(page, key, ix);

-- 两层权限的第一层：表级 GRANT（匿名和登录用户都可读写这张表）
grant select, insert, update, delete on public.cuiyu_slots to anon, authenticated;
grant usage, select on sequence public.cuiyu_slots_id_seq to anon, authenticated;

-- 第二层：行级 RLS（这里放开所有行，前端 520 口令挡人）
alter table public.cuiyu_slots enable row level security;
drop policy if exists cuiyu_slots_all on public.cuiyu_slots;
create policy cuiyu_slots_all on public.cuiyu_slots
  for all to anon, authenticated
  using (true)
  with check (true);

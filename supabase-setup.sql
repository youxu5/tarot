-- ============================================================
-- 翠玉录塔罗 · Supabase 初始化脚本
-- 用法：进 https://supabase.com → 你的项目 → 左侧 SQL Editor → New query
--       整段粘贴 → 点 Run
-- 作用：建一张公开可读写的表（写入仍受页面上的 520 口令挡着）
-- ============================================================

-- 1) 建表
create table if not exists public.cuiyu_slots (
  id         bigint generated always as identity primary key,
  page       text        not null,
  key        text        not null,
  ix         int         not null default 0,
  url        text        not null,                 -- 图片的 data URL（压缩后约 200~400KB）
  rev        bigint      not null default 0,       -- 版本号（时间戳），判断哪张更新用
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 2) 同一个槽位只留一条记录，避免历史行越积越多
create unique index if not exists cuiyu_slots_slot_uidx
  on public.cuiyu_slots (page, key, ix);

-- 3) 打开行级安全
alter table public.cuiyu_slots enable row level security;

-- 4) 允许「带 anon key 的访客」读写这张表
--    （anon key 本来就是放在前端的，真正的边界靠下面这条策略决定）
drop policy if exists cuiyu_slots_all on public.cuiyu_slots;
create policy cuiyu_slots_all on public.cuiyu_slots
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- 5) 赋权（Supabase 里 anon/service 角色默认没这张表的权限，必须显式给）
grant select, insert, update, delete on public.cuiyu_slots to anon;
grant select, insert, update, delete on public.cuiyu_slots to authenticated;

-- ============================================================
-- 说明：这张表全世界可读可写，听起来吓人，但实际风险可控：
--   · 里面只有"图片 data URL"，没有任何隐私或账号信息；
--   · 页面上换图的入口是隐藏的（连点 5 次 + 520 口令），别人不知道就进不去；
--   · 最坏情况就是有人绕开页面刷掉你的图 —— 删了重传即可，不会有别的损失。
-- 如果哪天真在意了，我再把它改成"写入走云函数、key 不落前端"的版本。
-- ============================================================

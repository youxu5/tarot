// ============================================================
// 翠玉录塔罗 · 写入云函数 cuiyu-write
// 部署：Supabase → 左侧 Edge Functions → New function
//       名字填 cuiyu-write → 把本文件整段粘进去 → Deploy
//       （函数默认是开 JWT 校验的，保持开启即可：前端会带 anon key）
//
// 它为什么存在：
//   数据库已经改成「anon 只能读」。想改图，就必须经过这里。
//   这里拿的是 service_role 密钥，它写在服务端环境变量里，
//   永远不会发给浏览器 —— 所以别人翻遍前端源码也拿不到写权限。
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

// SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 由 Supabase 自动注入，不用自己设
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
// 这个要你自己设：Supabase → Project Settings → Edge Functions → Secrets
// 名字 CUIYU_PASSCODE，值就是你的上传口令（别再用 520）
const PASSCODE = Deno.env.get('CUIYU_PASSCODE') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: any, code: number) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405)
  if (!PASSCODE) return json({ ok: false, error: 'passcode not configured' }, 500)

  let body: any
  try {
    body = await req.json()
  } catch (_e) {
    return json({ ok: false, error: 'bad json' }, 400)
  }

  const action = String(body.action || '')
  const pass = String(body.passcode || '')

  // action=verify：只验口令，不动数据。前端拿它决定要不要弹上传框
  const okPass = pass === PASSCODE
  if (action === 'verify') {
    // 口令错了不告诉它错在哪，统一 401，避免被拿来试探
    return okPass ? json({ ok: true }, 200) : json({ ok: false }, 401)
  }

  if (!okPass) return json({ ok: false, error: 'passcode' }, 401)

  const page = String(body.page || 'cuiyulu')
  const key = String(body.key || '')
  const ix = Number(body.ix || 0)
  if (!key) return json({ ok: false, error: 'missing key' }, 400)

  // service_role 角色的请求头：它绕过 RLS，所以能写
  const HEADERS = {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
  }
  const base = SUPABASE_URL + '/rest/v1/cuiyu_slots'

  if (action === 'save') {
    const url = String(body.url || '')
    const rev = Number(body.rev || Date.now())
    if (!url) return json({ ok: false, error: 'missing url' }, 400)

    // 先查后写：这样不依赖任何唯一索引，表结构什么样都能跑
    const qsel = '?select=id&page=eq.' + encodeURIComponent(page) +
                 '&key=eq.' + encodeURIComponent(key) +
                 '&ix=eq.' + encodeURIComponent(String(ix)) + '&limit=1'
    const rd = await fetch(base + qsel, { headers: HEADERS })
    let id: number | null = null
    if (rd.ok) {
      const rows = await rd.json().catch(() => [])
      if (Array.isArray(rows) && rows.length && rows[0] && rows[0].id != null) id = Number(rows[0].id)
    }

    let r: Response
    if (id != null) {
      // 已有槽位 → 改这一行。不碰 created_at，创建时间不该被更新带走
      r = await fetch(base + '?id=eq.' + id, {
        method: 'PATCH',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          url, rev,
          updated_at: new Date().toISOString(),
        }),
      })
    } else {
      r = await fetch(base, {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify([{
          page, key, ix, url, rev,
          updated_at: new Date().toISOString(),
        }]),
      })
    }
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return json({ ok: false, error: 'db ' + r.status + ' ' + t.slice(0, 120) }, 502)
    }
    return json({ ok: true, rev }, 200)
  }

  if (action === 'remove') {
    const q = '?page=eq.' + encodeURIComponent(page) +
              '&key=eq.' + encodeURIComponent(key) +
              '&ix=eq.' + encodeURIComponent(String(ix))
    const r = await fetch(base + q, {
      method: 'DELETE',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return json({ ok: false, error: 'db ' + r.status + ' ' + t.slice(0, 120) }, 502)
    }
    return json({ ok: true }, 200)
  }

  return json({ ok: false, error: 'unknown action' }, 400)
})

// ── ДЕНЬГИ — платёжный календарь, приходы, долги, кэш, офферы, лиды ───────────
// Самодостаточный экран: данные в localStorage 'lifeos_finance', сид — из онбординга.
import { TG } from '../telegram.js?v=61';

const KEY = 'lifeos_finance';

// ── СИД из онбординга Джорджа (июнь 2026) ────────────────────────────────────
const SEED = {
  incomeGoal: 500000,
  // Платёжный календарь: recurring — ежемесячные; day — число месяца; date — разовое
  payments: [
    { id:'p_pasha',  title:'Вернуть Паше',           amount:5000,   when:'завтра',     dueIn:1, cat:'мелкий долг', status:'due' },
    { id:'p_kolya',  title:'Вернуть Коле Боди',       amount:5000,   when:'сегодня',    dueIn:0, cat:'мелкий долг', status:'due' },
    { id:'p_credit', title:'Кредит (ежемес. до ноября)', amount:32000, when:'26 числа', day:26, recurring:true, cat:'кредит', status:'due', note:'осталось ~192к за 6 мес' },
    { id:'p_card',   title:'Кредитка — мин. платёж',  amount:18500,  when:'10 числа', day:10, recurring:true, cat:'кредит', status:'due', note:'общий долг ~300к' },
    { id:'p_food',   title:'Еда',                     amount:30000,  recurring:true, cat:'жизнь', status:'due' },
    { id:'p_ai',     title:'Нейросети / подписки',    amount:12000,  recurring:true, cat:'жизнь', status:'due' },
    { id:'p_fuel',   title:'Бензин',                  amount:10000,  recurring:true, cat:'жизнь', status:'due' },
    { id:'p_dacha',  title:'Дача',                    amount:10000,  recurring:true, cat:'жизнь', status:'due' },
    { id:'p_light',  title:'Свет',                    amount:5000,   recurring:true, cat:'жизнь', status:'due' },
    { id:'p_phone',  title:'Телефон',                 amount:1500,   recurring:true, cat:'жизнь', status:'due' },
    { id:'p_net',    title:'Интернет',                amount:1000,   recurring:true, cat:'жизнь', status:'due' },
    { id:'p_repair', title:'Ремонт дачи (по минималке)', amount:30000, when:'разовое', cat:'разовое', status:'due', note:'свет, бельё, краска' },
  ],
  // Долги без жёсткой даты — по приоритету
  debts: [
    { id:'d_grisha',  name:'Гриша',     amount:230000, status:'open' },
    { id:'d_mom',     name:'Мама',      amount:400000, status:'open' },
    { id:'d_alex',    name:'Александр (муж мамы)', amount:400000, status:'open' },
    { id:'d_bank',    name:'Банк / прочее', amount:1000000, status:'open' },
    { id:'d_dima',    name:'Дима Ющенко', amount:10000, status:'open' },
    { id:'d_valera',  name:'Валера',    amount:10000, status:'open' },
    { id:'d_slava',   name:'Слава',     amount:10000, status:'open' },
    { id:'d_larisa',  name:'Лариса',    amount:5000,  status:'open' },
  ],
  expectedIncome: [
    { id:'i_natasha', from:'Наташа — бот-стилист', amount:155000, when:'с 15–20 июня частями', status:'ожидается', note:'на этой неделе ждём 30–50к; остаток частями до июля; дожать продукт' },
    { id:'i_lesha',   from:'Помощь привлечь 500к (Лёша)', amount:15000, when:'если выгорит', status:'под вопросом', note:'вероятно уйдёт в погашение долга Лёше 15к' },
  ],
  sellItems: [
    { id:'s_moto',  name:'Мотоцикл',          price:'60–100к', decision:'НЕ продавать без зазора — нужен транспорт на даче. Менять только на равноценный.', status:'обдумать' },
    { id:'s_heat',  name:'2 водонагревателя', price:'~10к',    decision:'Выставить с дачного адреса (в Москве звонков не было).', status:'выставить' },
    { id:'s_motor', name:'Старый лодочный мотор', price:'0–5к', decision:'Почти хлам, скорее утилизировать. Низкий приоритет.', status:'низкий' },
    { id:'s_bike',  name:'Велосипед',         price:'~15к',    decision:'НЕ продавать — память + выгода мала (лендинг даёт больше за часы).', status:'не продавать' },
    { id:'s_lap',   name:'Ноутбук (рабочий)', price:'50–60к',  decision:'НЕ продавать — ключевой инструмент, выгода ~20к не стоит гемора.', status:'не продавать' },
    { id:'s_oldlap',name:'Старый ноутбук',    price:'10–12к',  decision:'Можно продать (но возня с переносом ради ~20–30к).', status:'можно' },
    { id:'s_phone', name:'iPhone 12 Pro Max', price:'~?',      decision:'Смысла менять нет.', status:'не продавать' },
    { id:'s_boat',  name:'Надувная лодка',    price:'—',       decision:'Память о папе — оставить.', status:'не продавать' },
  ],
  offers: [
    { name:'Продающие лендинги (CRM, лид-магниты, адаптив)', price:'10–150к' },
    { name:'Telegram-боты / агенты-продавцы (голос+текст)', price:'10–100к+' },
    { name:'Telegram Mini App (приложение)', price:'30–100к+' },
    { name:'Instagram-агенты (директ/комменты)', price:'обсуждаемо' },
    { name:'Автоматизации продаж/маркетинга/аналитики (n8n)', price:'обсуждаемо' },
    { name:'Аналитика маркетплейсов (реанимировать сервис, подписка)', price:'подписка' },
    { name:'Карточки + продающие воронки для маркетплейсов', price:'обсуждаемо' },
    { name:'Сервис/услуга красивых презентаций', price:'обсуждаемо' },
    { name:'Консалтинг и обучение ИИ (быстрые деньги)', price:'почасово/пакет' },
    { name:'Обучающие продукты: микро / средние / флагман', price:'2–5к / 10–50к / 70–150к' },
    { name:'Контент: видео/презентации/аватары + контент-заводы', price:'обсуждаемо' },
  ],
  leads: [
    { id:'l_katya',  name:'Катя Диденко (блогер 1.4М)', what:'Совместный запуск через 2–3 нед: продукт+воронка+боты+обучение, с неё трафик', hot:true, status:'new' },
    { id:'l_irina',  name:'Ирина Каримова', what:'Боты + голосовой/текстовый агент-продавец. Готова финансировать', hot:true, status:'new' },
    { id:'l_olga',   name:'Ольга (недвижимость)', what:'Лидогенерация через ИИ — был интерес', hot:true, status:'new' },
    { id:'l_roma',   name:'Рома (отдел продаж, производство)', what:'Автоматизация отдела продаж', hot:true, status:'new' },
    { id:'l_natasha',name:'Наташа', what:'Доплата 155к + апсейл по боту-стилисту', status:'new' },
    { id:'l_misha',  name:'Миша Тимочка (блогер 1.5М, клуб ~15М/мес)', what:'Подключиться, наладить систему управления', status:'new' },
    { id:'l_egor',   name:'Егор Пыриков (продюсер запусков)', what:'Войти подрядчиком / встреча, точки соприкосновения', status:'new' },
    { id:'l_viktor', name:'Виктор Фидюшин (банкротство)', what:'Интеграции/автоматизации — ниша богатая на AI', status:'new' },
    { id:'l_dimon',  name:'Димон (Грузия, блог 100к+)', what:'Совместный продукт/запуск', status:'new' },
    { id:'l_lena',   name:'Лена', what:'Подключить к продажам/процессам', status:'new' },
    { id:'l_liza',   name:'Подруга (vibe-coding)', what:'Помочь запустить продажи, доля прибыли', status:'new' },
    { id:'l_masha',  name:'Маша (финсервисы)', what:'Прощупать совместное', status:'new' },
    { id:'l_sasha',  name:'Саша Морозов (стройка)', what:'Оффер автоматизации', status:'new' },
    { id:'l_pasha',  name:'Паша Ходыкин', what:'Автоматизации для бизнеса', status:'new' },
    { id:'l_mm',     name:'Мастермайнд (2 Татьяны)', what:'Прощупать, чем полезен', status:'new' },
    { id:'l_lea',    name:'Лея (риэлтор Дубай)', what:'Обязательство 24к — закрыть/возврат, деликатно', status:'new' },
    { id:'l_sellers',name:'Друзья-селлеры', what:'Подумать оффер (аналитика/карточки/автоматизация)', status:'new' },
  ],
  actions: [
    { id:'a_ooo1', text:'Сменить гендира ООО с мамы на себя (есть юрлицо для приёма денег!)', done:false },
    { id:'a_ooo2', text:'Разобраться с отчётностью за Q2 + сделать печать', done:false },
    { id:'a_pack', text:'Упаковать себя/услуги: сайт, кейсы, скрипты продаж', done:false },
    { id:'a_calls',text:'Обзвон по Яндекс.Картам → продавать встречи (деньги принимать на ООО)', done:false },
    { id:'a_mp',   text:'Реанимировать сервис аналитики маркетплейсов (подписка)', done:false },
  ],
};

function getFin() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch {}
  saveFin(SEED);   // первый раз — сохраняем сид и пушим в Supabase
  return SEED;
}
function saveFin(f) { localStorage.setItem(KEY, JSON.stringify(f)); window._дбHook?.('finance', f); }
const fmt = n => (typeof n === 'number' ? n.toLocaleString('ru-RU') + ' ₽' : n);

export function renderFinance() {
  const f = getFin();
  const el = document.getElementById('content');

  const monthlyDue = f.payments.filter(p => p.status !== 'paid').reduce((s,p)=>s+(p.amount||0),0);
  const debtsTotal = f.debts.filter(d => d.status==='open').reduce((s,d)=>s+(d.amount||0),0);
  const expectedTotal = f.expectedIncome.filter(i=>i.status!=='received').reduce((s,i)=>s+(typeof i.amount==='number'?i.amount:0),0);

  // ── Сводка ────────────────────────────────────────────────────────────────
  const summary = `<div class="card" style="margin-bottom:12px">
    <div class="sec-label">💰 СВОДКА · ДЕНЬГИ</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
      ${[
        ['🎯 Цель/мес', fmt(f.incomeGoal), '#00E396'],
        ['📅 Платежей', fmt(monthlyDue), '#F5B942'],
        ['📈 Ждём прихода', fmt(expectedTotal), '#00D4FF'],
        ['💸 Всего долгов', fmt(debtsTotal), '#FF5C8A'],
      ].map(([l,v,c])=>`<div style="background:var(--surface3);border:1px solid var(--border);border-radius:12px;padding:10px 12px">
        <div style="font-size:10px;color:rgba(232,237,245,.45)">${l}</div>
        <div class="num" style="font-size:17px;color:${c};margin-top:2px">${v}</div>
      </div>`).join('')}
    </div>
  </div>`;

  const strategy = `<div class="card" style="margin-bottom:12px;border-left:3px solid #00E396">
    <div style="font-size:12px;color:#00E396;font-weight:700;margin-bottom:4px">🔥 Стратегия</div>
    <div style="font-size:12px;color:rgba(232,237,245,.7);line-height:1.5">
      Топ-1 — не распродажа хлама, а <b>упаковка услуг и активные продажи</b>. День работы (лендинг) = 15–30к, больше чем продажа вещей. Комбинируй: быстрый низкий чек под горящие платежи + крупные сделки/запуски.
    </div>
  </div>`;

  // ── Платёжный календарь (авто-подсветка по датам) ───────────────────────────
  // Возвращает кол-во дней до платежа (null если без даты): <0 просрочено, 0 сегодня
  const daysToPay = p => {
    const today = new Date(); today.setHours(0,0,0,0);
    if (typeof p.dueIn === 'number') return p.dueIn;
    if (p.day) {
      let d = new Date(today.getFullYear(), today.getMonth(), p.day);
      if (d < today) d = new Date(today.getFullYear(), today.getMonth()+1, p.day);
      return Math.round((d - today) / 86400000);
    }
    return null;
  };
  const urgency = d => {
    if (d == null) return { color:'rgba(232,237,245,.4)', chip:'', glow:false };
    if (d < 0)  return { color:'#FF4560', chip:`🔴 просрочено ${-d} дн.`, glow:true };
    if (d === 0) return { color:'#FF4560', chip:'🔥 сегодня', glow:true };
    if (d === 1) return { color:'#FF9F43', chip:'⚠️ завтра', glow:true };
    if (d <= 3)  return { color:'#F5B942', chip:`через ${d} дн.`, glow:false };
    return { color:'rgba(232,237,245,.4)', chip:`через ${d} дн.`, glow:false };
  };

  const payRow = p => {
    const paid = p.status === 'paid';
    const d = paid ? null : daysToPay(p);
    const u = urgency(d);
    const когда = p.when || (p.recurring ? 'ежемесячно' : '');
    const tagC = p.cat==='кредит'?'#FF9F43':p.cat==='мелкий долг'?'#FF5C8A':p.cat==='разовое'?'#7C3AED':'#00D4FF';
    const chip = (!paid && u.chip) ? `<span style="font-size:9px;color:${u.color};border:1px solid ${u.color}55;border-radius:6px;padding:1px 6px;margin-left:6px">${u.chip}</span>` : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);${paid?'opacity:.5':''}${u.glow&&!paid?';background:linear-gradient(90deg,'+u.color+'14,transparent);border-radius:8px;padding-left:8px':''}">
      <button onclick="window.finPay('${p.id}')" style="width:22px;height:22px;border-radius:6px;border:1.5px solid ${paid?'#00E396':'rgba(255,255,255,.2)'};background:${paid?'rgba(0,227,150,.2)':'transparent'};color:#00E396;font-size:12px;cursor:pointer;flex-shrink:0">${paid?'✓':''}</button>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;${paid?'text-decoration:line-through':''}">${p.title}${chip}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4)">${когда}${p.note?' · '+p.note:''}</div>
      </div>
      <div class="num" style="font-size:14px;color:${tagC};flex-shrink:0">${fmt(p.amount)}</div>
    </div>`;
  };
  // Сортировка: неоплаченные по срочности (ближе срок — выше), без даты — в конец, оплаченные — в самый низ
  const sortedPays = f.payments.slice().sort((a,b) => {
    if ((a.status==='paid') !== (b.status==='paid')) return a.status==='paid' ? 1 : -1;
    const da = daysToPay(a), db = daysToPay(b);
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  });
  const горит = sortedPays.filter(p => p.status!=='paid' && (daysToPay(p) != null && daysToPay(p) <= 1)).length;
  const calendar = `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between"><div class="sec-label" style="margin:0">📅 ПЛАТЁЖНЫЙ КАЛЕНДАРЬ</div>${горит?`<span style="font-size:10px;color:#FF4560">🔥 горит: ${горит}</span>`:''}</div>
    <div style="margin-top:8px">${sortedPays.map(payRow).join('')}</div>
  </div>`;

  // ── Долги ───────────────────────────────────────────────────────────────────
  const debts = `<div class="card" style="margin-bottom:12px">
    <div class="sec-label">💸 ДОЛГИ · ${fmt(debtsTotal)}</div>
    ${f.debts.slice().sort((a,b)=>b.amount-a.amount).map(d=>{
      const paid = d.status==='paid';
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);${paid?'opacity:.5':''}">
        <button onclick="window.finDebt('${d.id}')" style="width:22px;height:22px;border-radius:6px;border:1.5px solid ${paid?'#00E396':'rgba(255,255,255,.2)'};background:${paid?'rgba(0,227,150,.2)':'transparent'};color:#00E396;font-size:12px;cursor:pointer;flex-shrink:0">${paid?'✓':''}</button>
        <div style="flex:1;font-size:13px;${paid?'text-decoration:line-through':''}">${d.name}</div>
        <div class="num" style="font-size:14px;color:#FF5C8A">${fmt(d.amount)}</div>
      </div>`;
    }).join('')}
  </div>`;

  // ── Ожидаемые приходы ────────────────────────────────────────────────────────
  const income = `<div class="card" style="margin-bottom:12px">
    <div class="sec-label">📈 ОЖИДАЕМЫЕ ПРИХОДЫ</div>
    ${f.expectedIncome.map(i=>`<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <div class="row" style="justify-content:space-between"><div style="font-size:13px;font-weight:600">${i.from}</div><div class="num" style="font-size:14px;color:#00E396">${fmt(i.amount)}</div></div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${i.when} · ${i.status}${i.note?' · '+i.note:''}</div>
    </div>`).join('')}
  </div>`;

  // ── Быстрый кэш (вещи) ───────────────────────────────────────────────────────
  const cashColor = s => s==='выставить'||s==='можно'?'#00E396':s==='обдумать'?'#F5B942':s==='низкий'?'rgba(232,237,245,.4)':'#FF5C8A';
  const sell = `<div class="card" style="margin-bottom:12px">
    <div class="sec-label">🏷️ БЫСТРЫЙ КЭШ · вещи</div>
    ${f.sellItems.map(s=>`<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <div class="row" style="justify-content:space-between">
        <div style="font-size:13px;font-weight:600">${s.name}</div>
        <div style="display:flex;gap:8px;align-items:center"><span class="num" style="font-size:13px;color:#F5B942">${s.price}</span>
        <span style="font-size:9px;color:${cashColor(s.status)};border:1px solid ${cashColor(s.status)}55;border-radius:6px;padding:2px 6px">${s.status}</span></div>
      </div>
      <div style="font-size:10px;color:rgba(232,237,245,.45);margin-top:3px;line-height:1.4">${s.decision}</div>
    </div>`).join('')}
  </div>`;

  // ── Офферы / услуги ──────────────────────────────────────────────────────────
  const offers = `<div class="card" style="margin-bottom:12px">
    <div class="sec-label">🧰 ОФФЕРЫ · что продаём</div>
    ${f.offers.map(o=>`<div class="row" style="justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">
      <div style="font-size:12px;flex:1">${o.name}</div>
      <div style="font-size:11px;color:#00D4FF;flex-shrink:0;margin-left:8px">${o.price}</div>
    </div>`).join('')}
  </div>`;

  // ── Тёплые лиды ──────────────────────────────────────────────────────────────
  const leads = `<div class="card" style="margin-bottom:12px">
    <div class="sec-label">🔥 ТЁПЛЫЕ ЛИДЫ · кому написать</div>
    ${f.leads.map(l=>{
      const done = l.status==='contacted';
      return `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);${done?'opacity:.5':''}">
        <button onclick="window.finLead('${l.id}')" style="width:22px;height:22px;border-radius:6px;border:1.5px solid ${done?'#00E396':'rgba(255,255,255,.2)'};background:${done?'rgba(0,227,150,.2)':'transparent'};color:#00E396;font-size:11px;cursor:pointer;flex-shrink:0;align-self:flex-start;margin-top:2px">${done?'✓':''}</button>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${l.hot?'⭐ ':''}${l.name}</div>
          <div style="font-size:10px;color:rgba(232,237,245,.45);margin-top:2px;line-height:1.4">${l.what}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // ── Денежные действия ────────────────────────────────────────────────────────
  const actions = `<div class="card" style="margin-bottom:12px">
    <div class="sec-label">✅ ДЕНЕЖНЫЕ ДЕЙСТВИЯ</div>
    ${f.actions.map(a=>`<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);${a.done?'opacity:.5':''}">
      <button onclick="window.finAction('${a.id}')" style="width:22px;height:22px;border-radius:6px;border:1.5px solid ${a.done?'#00E396':'rgba(255,255,255,.2)'};background:${a.done?'rgba(0,227,150,.2)':'transparent'};color:#00E396;font-size:12px;cursor:pointer;flex-shrink:0">${a.done?'✓':''}</button>
      <div style="flex:1;font-size:12px;${a.done?'text-decoration:line-through':''}">${a.text}</div>
    </div>`).join('')}
  </div>`;

  el.innerHTML = `<div class="screen">
    <div style="margin-bottom:14px">
      <div style="font-size:22px;font-weight:800;letter-spacing:.02em">💰 ДЕНЬГИ</div>
      <div style="font-size:11px;color:rgba(232,237,245,.45)">Платежи · приходы · долги · продажи · лиды</div>
    </div>
    ${summary}${strategy}${calendar}${income}${debts}${leads}${offers}${sell}${actions}
    <div style="height:16px"></div>
  </div>`;
  TG.hideMainButton?.(); TG.hideBackButton?.();
}

// ── Тоглы статусов ────────────────────────────────────────────────────────────
window.finPay = function(id){ const f=getFin(); const p=f.payments.find(x=>x.id===id); if(p){p.status=p.status==='paid'?'due':'paid'; saveFin(f); renderFinance(); TG.hapticSelection?.(); if(p.status==='paid')window.showToast?.('Платёж отмечен оплаченным','success'); } };
window.finDebt = function(id){ const f=getFin(); const d=f.debts.find(x=>x.id===id); if(d){d.status=d.status==='paid'?'open':'paid'; saveFin(f); renderFinance(); TG.hapticSelection?.(); } };
window.finLead = function(id){ const f=getFin(); const l=f.leads.find(x=>x.id===id); if(l){l.status=l.status==='contacted'?'new':'contacted'; saveFin(f); renderFinance(); TG.hapticSelection?.(); } };
window.finAction = function(id){ const f=getFin(); const a=f.actions.find(x=>x.id===id); if(a){a.done=!a.done; saveFin(f); renderFinance(); TG.hapticSelection?.(); } };

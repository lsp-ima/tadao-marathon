// 申込画面と管理画面で共通に使うもの
// API_URL が空のあいだは、この端末の中だけで動く試し用(本番のデータには触れない)
const API_URL = 'https://script.google.com/macros/s/AKfycbx-ZXPFpu72evAXNjRTN2dkJxxh9GiI6DBqc4KZjjp64S8NGwE_nTPJxjJUXmsS2halFA/exec';

const SCHOOLS = ['図師小','忠生小','山崎小','忠生中','ライオンズ','成人','その他'];
const GRADES  = ['小1','小2','小3','小4','小5','小6','中1','中2','中3'];
const GRADE_ORDER = GRADES.concat(['成人']);
const RACES = ['第1レース 小1・2年 男子','第2レース 小1・2年 女子','第3レース 小3・4年 男子',
               '第4レース 小3・4年 女子','第5レース 小5・6年 男女合同','第6レース 中学生・成人 男女混合'];

function raceOf(grade, sex){
  const n = { '小1':1,'小2':1,'小3':3,'小4':3,'小5':5,'小6':5 }[grade];
  if (!grade || (!sex && n !== 5 && n)) return '';
  if (n === 1) return sex === '男子' ? RACES[0] : RACES[1];
  if (n === 3) return sex === '男子' ? RACES[2] : RACES[3];
  if (n === 5) return RACES[4];
  return RACES[5];
}
// 学年から距離の欄を選ぶ(値は「設定」シートの 距離 ◯◯)
function distOf(grade, dist){
  const n = { '小1':'low','小2':'low','小3':'mid','小4':'mid','小5':'mid','小6':'mid' }[grade] || 'high';
  return (dist && dist[n]) || '';
}
function gradeLabel(g){ return g === '成人' ? '成人' : g.replace('小','小学').replace('中','中学') + '年'; }
function toKata(s){ return String(s || '').replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60)); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
const $ = (s, el) => (el || document).querySelector(s);

async function api(action, payload){
  const body = Object.assign({ action }, payload || {});
  if (!API_URL) return mockApi(body);
  // Google側がまれにエラーページを返すので1度だけ再送する(申込は送信IDで二重登録を防いでいる)
  let last = null;
  for (let i = 0; i < 2; i++) {
    if (i) await new Promise(s => setTimeout(s, 1800));
    let txt;
    try { txt = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify(body) })).text(); }
    catch (e) { last = e; continue; }
    let j;
    try { j = JSON.parse(txt); } catch (e) { last = e; continue; }
    if (!j.ok) throw new Error(j.error || '通信に失敗しました');
    return j;
  }
  throw new Error('サーバーにつながりませんでした。少し待ってもう一度お試しください。');
}

// ---------- 試し用(API_URL が空のとき) ----------
function mockApi(b){
  const K = 'marathon-mock';
  let db; try { db = JSON.parse(localStorage.getItem(K)) || {}; } catch (e) { db = {}; }
  db.rows = db.rows || []; db.deadline = db.deadline || '';
  const save = () => { try { localStorage.setItem(K, JSON.stringify(db)); } catch (e) {} };
  const conf = () => { const d = db.deadline ? new Date(db.deadline + ':00+09:00') : null;
    return { eventName: '忠生マラソン祭り', deadline: db.deadline, open: !d || Date.now() < d.getTime() }; };
  const rnd = n => { const C = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += C[Math.floor(Math.random() * C.length)]; return s; };
  return new Promise(res => setTimeout(res, 400)).then(() => {
    if (b.action === 'config') return Object.assign({ ok: true }, conf());
    if (b.action === 'apply') {
      if (!conf().open) throw new Error('申込の受付は終了しました');
      const g = b.guardian, group = rnd(8), token = rnd(24), link = rnd(6), now = new Date().toLocaleString('ja-JP');
      const rows = b.kids.map(k => {
        const grade = k.school === '成人' ? '成人' : k.grade;
        return { '受付コード': rnd(6), '申込番号': group, '申込日時': now,
          '所属': k.school === 'その他' ? 'その他(' + k.schoolOther + ')' : k.school,
          '氏名': k.name, 'フリガナ': toKata(k.kana), '学年': grade, '性別': k.sex, 'レース': raceOf(grade, k.sex),
          '保護者氏名': g.name, '保護者フリガナ': toKata(g.kana), '電話': g.tel.replace(/[^\d]/g, ''), 'メール': g.email,
          '状態': '申込', 'キャンセル日時': '', '受付日時': '', token, link };
      });
      db.rows = db.rows.concat(rows); save();
      return { ok: true, group, token, kids: rows.map(r => ({ name: r['氏名'], code: r['受付コード'], race: r['レース'] })) };
    }
    if (b.action === 'login') { const r = db.rows.find(r => r['申込番号'] === String(b.group).toUpperCase() && r['電話'] === String(b.tel).replace(/[^\d]/g, ''));
      if (!r) throw new Error('申込番号か電話番号が違います'); return { ok: true, token: r.token }; }
    if (b.action === 'mypage' || b.action === 'cancel') {
      const mine = db.rows.filter(r => r.token === b.token);
      if (!mine.length) throw new Error('申込が見つかりません。申込番号と電話番号で開き直してください');
      if (b.action === 'cancel') { const r = mine.find(r => r['受付コード'] === b.code); r['状態'] = 'キャンセル'; r['キャンセル日時'] = new Date().toLocaleString('ja-JP'); save(); }
      return { ok: true, eventName: '忠生マラソン祭り', group: mine[0]['申込番号'], guardian: mine[0]['保護者氏名'], link: mine[0].link, linked: false,
        info: { notice: '3月6日(土)の大会は予定どおり行います。集合時間は2月中にお知らせします。', date: '', gather: '', place: '忠生スポーツ公園', rain: '', line: '@958pbsjm', dist: { low: '2周(1.0km)', mid: '3周(1.5km)', high: '' }, canCancel: true },
        kids: mine.map(r => ({ code: r['受付コード'], name: r['氏名'], school: r['所属'], grade: r['学年'], sex: r['性別'], race: r['レース'], state: r['状態'], checkedIn: false })) };
    }
    if (!b.pass) throw new Error('合言葉が違います');
    if (b.action === 'admin_list') return { ok: true, rows: db.rows, conf: conf() };
    if (b.action === 'admin_deadline') { db.deadline = b.deadline || ''; save(); return Object.assign({ ok: true }, conf()); }
    if (b.action === 'admin_export') throw new Error('Excel・PDFはサーバーにつないだ後に使えます(試し用では出せません)');
    throw new Error('不明な操作です');
  });
}

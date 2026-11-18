import { randomUUID } from 'node:crypto';

export const publicKeys = ['title','subtitle','description','area','duration','price','capacity','included','excluded','image','language'];
export const kinds = ['plan','magazine','video'];
export function publicPlan(p) { return Object.fromEntries(publicKeys.map(k => [k, p[k] ?? ''])); }
export function validateRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('入力が不正です');
  if (!kinds.includes(input.kind)) throw new Error('種類が不正です');
  const out = {kind:input.kind};
  const fields = [...publicKeys,'notes','cost','theme','audience','angle','cta','caption','platform','sources','productionNotes'];
  for (const field of fields) {
    const value = input[field] ?? '';
    if (typeof value !== 'string' || value.length > 20000) throw new Error(`${field}: 文字数または形式を確認してください`);
    out[field] = value.trim();
  }
  if (!out.title || out.title.length > 160) throw new Error('タイトルを1〜160文字で入力してください');
  if (out.image && !/^https:\/\//.test(out.image)) throw new Error('写真URLは https:// で指定してください');
  out.stage = ['idea','production','review','ready'].includes(input.stage) ? input.stage : 'idea';
  out.blocks = Array.isArray(input.blocks) ? input.blocks.map(b => {
    if (!b || typeof b !== 'object') throw new Error('ページ・カットが不正です');
    const row = {};
    for (const k of ['title','body','visual','narration','image']) {
      if (b[k] !== undefined && typeof b[k] !== 'string') throw new Error('ページ・カットはテキストで入力してください');
      row[k] = (b[k] || '').slice(0,10000);
    }
    if (row.image && !/^https:\/\//.test(row.image)) throw new Error('画像URLは https:// で指定してください');
    row.seconds = Math.min(30,Math.max(1,Number(b.seconds)||5));
    return row;
  }).slice(0,30) : [];
  return out;
}

export function generateOutline(p) {
  const topic = p.theme || p.title;
  const angle = p.angle || '日常の風景から、その背景にある問いをたどる';
  if (p.kind === 'magazine') return [
    {title:topic, body:angle, visual:'表紙：テーマを象徴する実写を大きく。余白を残した白地。',narration:'',image:p.image,seconds:5},
    {title:'ひとつの問いから',body:`${topic}について、なぜ今知りたいのか。自分の体験を起点に導入を書く。`,visual:'導入：短いリードと小さな写真。問いを一つに絞る。',seconds:5},
    {title:'現場で見つけたこと',body:'取材で確かめた事実、場所、日時、話し手を記入。推測と事実を分ける。',visual:'見開き：大きな写真とキャプション。',seconds:5},
    {title:'背景を読み解く',body:'資料で確認した背景を説明。出典と確認日を添える。未確認の歴史や引用は公開しない。',visual:'図解または2段組み。説明は短い段落で。',seconds:5},
    {title:'暮らしに持ち帰る',body:'観察から自分が考えたこと。事実と解釈を区別し、読者に問いを残す。',visual:'余白を広く取り、短い本文と写真1枚。',seconds:5},
    {title:'その先へ',body:p.cta || 'あなたなら、どんな風景に目を留めますか。',visual:'クレジット、出典、次の体験への案内。',seconds:5}
  ];
  return [
    {title:'問いかけ',body:topic,visual:'象徴的なディテールの寄り。タイトルを短く表示。',narration:`${topic}。あなたはどう感じますか。`,seconds:3},
    {title:'場所へ入る',body:'どこで、何に出会ったか',visual:'引きの画から現場へ。地名は確認済みのものを入れる。',narration:'ここに取材場所と、自分が気になったことを入れる。',seconds:5},
    {title:'観察する',body:angle,visual:'手元、素材、動作のディテールを2〜3カット。',narration:'ここに現地で観察した事実を入れる。',seconds:7},
    {title:'背景を知る',body:'確かめた背景を、一つだけ',visual:'資料や図解。出典を画面に添える。',narration:'ここに資料・取材で確認した背景を入れる。',seconds:7},
    {title:'自分の視点',body:'その風景は、今にどうつながるか',visual:'現代の生活と対比。余韻のある画を残す。',narration:'ここに自分の解釈を、解釈だと分かる言葉で入れる。',seconds:5},
    {title:'余韻と案内',body:p.cta || 'もっと知る / SONO',visual:'SONOの署名。関連する記事や体験への導線。',narration:p.cta || '続きは、SONOで。',seconds:3}
  ];
}

export function newRecord(kind='plan') {
 return {id:randomUUID(),kind,title:kind==='plan'?'新しい体験プラン':kind==='magazine'?'新しいMagazine':'新しい動画',stage:'idea',blocks:[]};
}

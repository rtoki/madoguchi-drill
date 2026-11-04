#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 rtoki
# SPDX-License-Identifier: MIT

"""Compile the authored manuscript and the choices that change its outcome."""
from pathlib import Path
import json, re, itertools

root = Path(__file__).resolve().parent / "authoring"
old = json.loads((root.parent / 'story.json').read_text())
decisions = {
 'envelope': {'prompt':'預かった封筒を、どうする？','options':[
  {'id':'sealed','label':'開けずに、真鍋さんへ渡す'},
  {'id':'open','label':'封を切って、中を見る','ending':'envelope_open'}]},
 'rescue': {'prompt':'呼びかけても反応がない。どう動く？','options':[
  {'id':'stay','label':'ここで助けを呼び、救命を始める'},
  {'id':'leave','label':'医務室へ行き、先生を探す','ending':'rescue_delay'}]},
 'issuance': {'interaction':'counter','prompt':'提示された書類を確かめ、窓口で応対する。','options':[
  {'id':'hold','label':'交付を保留し、係長に確認を頼む'},
  {'id':'issue','label':'このまま住民票を発行し、女性に渡す','ending':'wrong_issue'}]},
 'woman': {'prompt':'封筒を誰が読んだか聞かれた。どう答える？','options':[
  {'id':'explain','label':'係長も朝の相談に入っていると伝える'},
  {'id':'ask','label':'預かった相談には答えず、知りたい理由を尋ねる'}]},
}
extra_raw=(root/'story-family-route-details.md').read_text()
extras={m.group(1):m.group(2) for m in re.finditer(r'^## (\w+=\w+)\n(.*?)(?=^## |\Z)',extra_raw,re.M|re.S)}
source='\n\n'.join((root/f).read_text() for f in ['story-family-longform.md','story-family-act2.md','story-family-act3.md'])
nodes_by_id={n['id']:n for n in old['nodes']}
inserted=set(); nodes=[]
def parse_pages(content,node_id):
    pages=[]; scene='bg'; portrait=None; route=None
    def add_extra():
        nonlocal route
        if route and route not in inserted and route in extras:
            inserted.add(route); parse(extras[route])
    def parse(text):
        nonlocal scene,portrait,route
        text=re.sub(r'^(@@ .*)$',r'\n\n\1\n\n',text,flags=re.M)
        for part in re.split(r'\n\s*\n',text.strip()):
            part=part.strip()
            if not part:continue
            if part.startswith('@@ '):
                for line in part.splitlines():
                    assert line.startswith('@@ '),line
                    cmd=line[3:]
                    if cmd.startswith('scene:'):scene=cmd[6:];portrait=None
                    elif cmd.startswith('portrait:'):portrait=cmd[9:]
                    elif cmd.startswith(('route:','section:')):
                        new=cmd.split(':',1)[1];add_extra();route=new
                    elif cmd=='common':add_extra();route=None
                    elif cmd.startswith('clue:'):pages[-1].setdefault('clues',[]).append(cmd[5:])
                    elif cmd.startswith('document:'):pages[-1]['document']=cmd[9:]
                    elif cmd.startswith('choice:'):pages[-1]['decision']=cmd[7:]
                    elif cmd.startswith('key:'):pages[-1]['key']=cmd[4:]
                    elif cmd=='beat:reveal':pages[-1]['beat']='reveal'
                    elif cmd.startswith('time:'):pages[-1]['time']=cmd[5:]
                    else:raise ValueError(cmd)
            else:
                assert not part.startswith('#'),part
                page={'key':f'{node_id}-{len(pages):03}','scene':scene,'text':part}
                if portrait:page['portrait']=portrait
                if route:
                    k,v=route.split('=')
                    if k not in decisions or v not in [o['id'] for o in decisions[k]['options']]:
                        raise ValueError(f'{node_id}: 未定義のroute: {route}')
                    page['when']={k:v}
                pages.append(page)
    parse(content);add_extra()
    assert len({p['key'] for p in pages})==len(pages),f'duplicate page keys: {node_id}'
    return pages

sections=list(re.finditer(r'^## (\w+)\n(.*?)(?=^## |\Z)',source,re.M|re.S))
for m in sections:
    node_id=m.group(1)
    n=dict(nodes_by_id.get(node_id,{'id':node_id,'time':'14:42','title':'庁舎の外','person':'rookie','needs':['next_morning'],'block':'b9','act':3}))
    n['pages']=parse_pages(m.group(2),node_id)
    nodes.append(n)
    if node_id=='r0':nodes.append(nodes_by_id['r2'])
assert set(extras)==inserted
by_id={n['id']:n for n in nodes}
by_id['next_morning'].update(title='警察の到着')
by_id['outside'].update(title='待っている人')
by_id['safety'].update(title='本当の家族')
by_id['phone']['needs']=['instructions']
by_id['outside']['needs']=['next_morning']
old['blocks']=[
 {'id':'ch1','act':1,'title':'午前九時','nodes':['r0','r2','r1','memo','stairs'],'intro':'開庁の時刻になった。最初の番号を呼ぶ。','person':'rookie'},
 {'id':'ch2','act':2,'title':'昼休み','nodes':['noon','daughter','instructions'],'intro':'昼休み。まだ半日あると思っていた。','person':'rookie'},
 {'id':'ch3','act':3,'title':'一本の電話','nodes':['phone','deduction','report','safety','next_morning','outside'],'intro':'窓口の電話が鳴った。','person':'rookie'},
]
for block in old['blocks']:
 for node_id in block['nodes']:by_id[node_id].update(block=block['id'],act=block['act'])
by_id['r1']['title']='待合の来庁者'
by_id['daughter']['title']='夕方の受付'

bad_source=(root/'story-family-bad-endings.md').read_text()
bad_endings={}
for m in re.finditer(r'^## (\w+)\n(.*?)(?=^## |\Z)',bad_source,re.M|re.S):
 meta={'envelope_open':{'title':'封を切ったあとで','node':'memo','decision':'envelope','label':'開けた封筒','retry':'封筒の選択からやり直す'},'rescue_delay':{'title':'戻れなかった五分','node':'noon','decision':'rescue','label':'昼休みの廊下','retry':'発見した場面からやり直す','note':'この結末は物語上の結果です。人工呼吸ができない・ためらわれる場合も、胸骨圧迫を続けます。周囲への応援要請、119番通報、AEDの手配を。','source':'https://med.or.jp/99/cpr.html'}}
 meta['wrong_issue']={'title':'渡してしまった一枚','node':'daughter','decision':'issuance','label':'午後の交付','retry':'免許証を受け取った場面からやり直す'}
 bad_endings[m[1]]={**meta[m[1]],'pages':parse_pages(m[2],m[1])}
for p in bad_endings['rescue_delay']['pages']:
 p['time']={'rescue_delay-000':'12:07','rescue_delay-001':'12:10','rescue_delay-002':'12:12','rescue_delay-003':'17:20','rescue_delay-004':'17:26'}[p['key'].split('--')[0]]
bad_endings={key:bad_endings[key] for key in ['envelope_open','rescue_delay','wrong_issue']}
old['bad_endings']=bad_endings

# Authored time anchors keep paperwork, waiting and short rescue actions distinct.
timing=json.loads((root/'story-family-timing.json').read_text())
def minute(value):
 h,m=map(int,value.split(':'));return h*60+m
def clock(value):return f'{value//60:02}:{value%60:02}'
for node_id,schedule in timing.items():
 n=by_id[node_id] if node_id in by_id else bad_endings[node_id]
 n['time']=schedule['start'];n['endTime']=schedule['end']
 pages=n['pages']
 if not pages:continue
 positions={p['key']:i for i,p in enumerate(pages)}
 points={0:minute(schedule['start']),len(pages)-1:minute(schedule['end'])}
 if len(pages)==1:points[0]=minute(schedule['start'])
 for key,value in schedule.get('anchors',{}).items():points[positions[key]]=minute(value)
 ordered=sorted(points.items())
 assert all(a[1]<=b[1] for a,b in zip(ordered,ordered[1:])),node_id
 for (i,start),(j,end) in zip(ordered,ordered[1:]):
  for k in range(i,j+1):pages[k]['time']=clock(start+(end-start)*(k-i)//(j-i))
 if len(pages)==1:pages[0]['time']=schedule['start']

# This ending crosses midnight explicitly in its prose. Keep the HUD clock
# consistent with "翌朝" without changing the ordinary one-day timeline.
for page in bad_endings['wrong_issue']['pages'][1:]:
 page.update(time='08:55',dayOffset=1)
bad_endings['wrong_issue'].update(endTime='08:55',endDayOffset=1)

# Source-based clues describe what the player has seen, never a private employee notebook.
clues={
'identity':('本人確認と待ち合わせ','朝の受付','吉田本人の証明書の用件は確認した。真鍋との10:40の約束も本人から聞いた。家族関係は確認していない。'),
'contact_card':('黒瀬が残した名刺','朝の取次ぎ','黒瀬本人が「黒瀬事務サポート」の名刺を出した。取次ぎのため職場の引継ぎ資料へ添えた。氏名は「黒瀬 修一」。'),
'husband_quote':('朝の「夫」という発言','待合の会話','吉田を「真鍋さんのご主人」と呼んだのは黒瀬。真鍋は電話中、吉田は離れた席で、二人はこの会話に加わっていない。'),
'argument':('踊り場で聞いた言葉','主人公が聞いた範囲','真鍋は黒瀬に頼まないよう求めた。吉田は元に戻りたいと言い、今は家に別の人がいると話した。家族関係や暴行の証拠にはならない。'),
'empty_desk':('昼の発見と空席','昼休み','吉田が倒れているのを発見。主人公は、真鍋が夫の搬送先へ向かったのだと思った。係長は本人へ電話したが、まだ連絡が取れていなかった。'),
'police_reaction':('通報を聞いたときの反応', '女性の言動', '警察へ連絡したと聞き、女性の握っていた手が緩んだ。「もう、連絡は済んだんですね」と確認し、ここで待つと答えた。'),
'instructions':('女性に届いた指示', '女性が提示した画面', '15:36、KRS-17から「真鍋の娘だと言え。同じ世帯で、続柄も。申請書だけで帰るな」。15:38には「約束がなくなってもいいのか」と届いていた。'),
'woman_account':('仕事の説明と、変わった指示', '女性の話', '家族の連絡を手伝う仕事だと説明されて引き受けた。後から免許証を渡され、娘を名乗るよう命じられた。断ると家族の所へ行くと告げられ、警察へ話したかったと説明した。'),
'woman_questions':('女性が心配していたこと', '奥の席での会話', '依頼者から朝の封筒の話を聞いたと説明し、真鍋一人が読んだのか尋ねた。ほかの人に封筒が渡ると話が変わると依頼者が言い、自分も相談先を聞かれると話した。'),
'woman_contact':('女性が挙げた名前と屋号', '係長への返答', '指示した相手を尋ねられ、女性は「黒瀬修一さんです。事務サポートの」と答えた。仕事で何度か会い、最初におかしいと思ったときもその人へ相談したと説明した。'),
'police_identity':('警察の身元確認','17:02の電話','搬送された男性は真鍋の夫ではないと、警察から確認された。朝に聞かされた関係が否定された。'),
'branch_morning_listen':('朝に託された言葉','朝の受け渡し','吉田は、ほかの職員ではなく真鍋本人へ封筒を渡してほしいと頼んだ。主人公は、渡したら知らせると答えた。封筒の中身は聞いていない。'),
'branch_morning_handoff':('引き継ぐ約束','真鍋への受け渡し','真鍋は自分だけで解決するとは約束せず、係長へもつなぐと話した。主人公は封をしたまま本人へ渡したことを吉田へ伝えた。'),
'branch_stairs_call':('相談をためらう言葉','相談室へ案内したとき','吉田は、相談をやめたら封筒を返してもらえるかと尋ねた。真鍋はまず座ろうと答えた。主人公はその後の相談には同席していない。'),
'branch_woman_explain':('分岐：係長も相談に入っていると伝えた', '女性へ返した言葉', '主人公は係長も朝の相談に入っていると答えた。保管場所は伝えなかった。女性は「一人だけじゃないんですね」と返した。'),
'branch_woman_ask':('分岐：相談の内容には答えず話を聞いた', '女性へ返した言葉', '主人公は封筒を読んだ人や置き場所を答えなかった。女性は仕事を辞めると約束がなくなると言われ、その約束には住む所も含むと話した。'),
'paper_copy':('残っていた紙の控え','係長と真鍋の確認','過去の紙の控えには子の記載があるが、後の書類では別の家族に変わっていた。真鍋は該当の人が娘を覚えていないと話し、記録の食い違いを最近調べ始めた。封筒の中身ではない。'),
'return_price':('二度目の見積書','吉田が提出した取引の控え','黒瀬事務サポート名義の控えに「調整完了」。後の「再調整」の見積額はさらに高い。控えは吉田が相談で提出したもので、封筒とは別に保管された。'),
'application_only':('申請書と証明書','夕方の窓口','申請書の印刷・署名まで進めたが、証明書は交付していない。女性は申請書ができたかを確かめ、証明書とは別だと聞いて、今日ここで受け取るよう言われたと答えた。'),
}
published={cid:(n,p,i) for n in nodes for i,p in enumerate(n['pages']) for cid in p.get('clues',[])}
assert set(clues)==set(published),(set(clues)-set(published),set(published)-set(clues))
old['clues']={}
for cid,(title,who,text) in clues.items():
 n,p,i=published[cid]
 c={'title':title,'who':who,'node':n['id'],'page':i,'pageKey':p['key'],'text':text}
 if p.get('when'):c['when']=p['when']
 old['clues'][cid]=c
old['puzzles']['source']={
 'title':'「夫」という話は誰から聞き、何で誤りと分かった？','shortTitle':'朝の紹介','count':2,
 'clues':['husband_quote','identity','argument','police_identity'],
 'correct':['husband_quote','police_identity'],'answer':'kurose',
 'options':[{'id':'yoshida','text':'吉田さんから聞き、踊り場の口論で誤りと分かった。'},
 {'id':'kurose','text':'黒瀬さんから聞き、警察の身元確認で誤りと分かった。'},
 {'id':'manabe','text':'真鍋さんから聞き、女性の来庁で誤りと分かった。'}],
 'hint':'朝に紹介した人の言葉と、電話で警察が確認したことを照らす。',
 'feedback':'朝に「ご主人」と紹介したのは黒瀬さん。夫ではないと確認したのは、電話の警察官だった。',
 'evidenceFeedback':'紹介した人が分かる朝の発言と、夫ではないと分かる警察の身元確認。この二つを確かめる。',
 'solved':'黒瀬さんが吉田さんを「真鍋さんのご主人」と紹介した。警察の身元確認で、その紹介が誤りだと分かった。'}
old['puzzles']['purpose']={
 'title':'女性は、なぜ娘を名乗ったと説明した？','shortTitle':'女性の説明','count':2,
 'clues':['instructions','woman_account','woman_questions','police_reaction','empty_desk'],
 'correct':['woman_account','instructions'],'answer':'deceived',
 'options':[{'id':'family','text':'本当の娘で、家族から手続きを頼まれたから。'},
 {'id':'deceived','text':'連絡を手伝う仕事を引き受けた後、娘を名乗るよう命じられたから。'},
 {'id':'voluntary','text':'誰にも指示されず、自分でそう決めたから。'}],
 'hint':'最初にどんな仕事と説明されたかと、その後に届いた指示を照らす。',
 'feedback':'女性は本当の娘ではない。家族の連絡を手伝う仕事だと説明され、後から別の指示を受けたと話した。',
 'evidenceFeedback':'来た経緯を考えるには、女性が話した仕事の説明と、娘を名乗るよう命じた文面を合わせる。',
 'solved':'女性は仕事の説明を信じて引き受け、後から娘役を命じられたと話した。提示された文面にも名乗りの指示がある。現段階では騙されたという本人の説明として警察へ引き継ぐ。本人の意思や送信元まで確認できたことにはしない。'}
old['puzzles']['concealment']={
 'title':'女性が依頼者として名前を挙げたのは、朝の誰か？','shortTitle':'依頼者の名前','count':2,
 'clues':['contact_card','woman_contact','argument','empty_desk'],
 'correct':['contact_card','woman_contact'],'answer':'shared_contact',
 'options':[{'id':'shared_contact','text':'名刺を残した黒瀬さん。名前も屋号も一致する。'},
 {'id':'letter_contents','text':'吉田さん。女性は彼の手紙を読み、内容を説明した。'},
 {'id':'family_introduction','text':'真鍋さん。女性を家族として紹介し、窓口に案内した。'}],
 'hint':'朝の名刺の名前・屋号と、女性が係長に答えた名前・屋号を照らす。',
 'feedback':'女性が挙げた「黒瀬修一、事務サポート」は、朝に名刺を残した黒瀬さんの名前・屋号と一致する。',
 'evidenceFeedback':'朝の名刺と、女性が挙げた依頼者の名前・屋号を照合する。口論や空席だけでは、依頼者の名前は分からない。',
 'solved':'朝の名刺と、女性が挙げた依頼者の名前・屋号が一致する。ここが二つの来庁を結ぶ接点になる。実際の指示の送信元は、警察による確認が必要だ。'}
old.pop('title',None)
old.update(nodes=nodes,decisions=decisions,schema_version=3,updated='2026-11-03',endingScene='scene-family-empty-desk',note='家族関係を書き換える交付をめぐる幻想ミステリー。三章・四つの選択。真鍋も最近食い違いに気づいた。過去の紙は残り、申請書の印刷では変化しない。封筒の中身とKRS-17は未解決。女性の供述は供述として推理し、家族の無事のあとに取引の別の面と女性の不在を知る。')
stats={'total_chars':sum(len(p['text']) for n in nodes for p in n['pages']),'total_pages':sum(len(n['pages']) for n in nodes)+1,'choices':len(decisions),'routes':1,'early_endings':len(bad_endings),'core_clues':sum(not c.get('when') for c in old['clues'].values()),'all_clues':len(clues)}
lengths=[];page_counts=[]
for options in itertools.product(*[[o['id'] for o in d['options'] if not o.get('ending')] for d in decisions.values()]):
 picks=dict(zip(decisions,options));pages=[p for n in nodes for p in n['pages'] if all(picks.get(k)==v for k,v in p.get('when',{}).items())]
 lengths.append(sum(len(p['text']) for p in pages));page_counts.append(len(pages)+1)
stats.update(path_chars_min=min(lengths),path_chars_max=max(lengths),path_pages_min=min(page_counts),path_pages_max=max(page_counts),max_page_chars=max(len(p['text']) for n in nodes for p in n['pages']))
stats['routes']=len(lengths)
stats['total_paths']=len(lengths)+len(bad_endings)
stats['bad_ending_chars']=sum(len(p['text']) for b in bad_endings.values() for p in b['pages'])
stats['total_chars']+=stats['bad_ending_chars']
stats['total_pages']+=sum(len(b['pages'])+1 for b in bad_endings.values())
old['stats']=stats
(root.parent/'story.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
(root/'STORY-FAMILY.md').write_text('# ストーリーモード — 全文・分岐\n\n'+f'本文合計 {stats["total_chars"]:,}字（分岐を含む）。一経路 {min(lengths):,}〜{max(lengths):,}字。四つの選択。完走2経路と、封筒・救命・住民票交付の選択による三つの早期終了。\n\n'+source+'\n\n# 分岐の追加場面\n\n'+extra_raw+'\n\n# 早期終了の場面\n\n'+bad_source)
print(json.dumps(stats,ensure_ascii=False))

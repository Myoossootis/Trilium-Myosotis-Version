"""Extract the user's local hardware exam collection; cache OCR, keep page provenance."""
from pathlib import Path
import json, re, unicodedata, hashlib, argparse
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'customizations/data/hardware-quiz'
CACHE = ROOT / 'tmp/quiz/ocr'
def norm(s):
    return unicodedata.normalize('NFKC', s).strip()

def extract(path, ocr_engine):
    doc = fitz.open(path); rows=[]; scanned=False
    for pi,p in enumerate(doc):
        lines=[]
        if len(p.get_text().strip()) < 20:
            scanned=True; key=hashlib.sha256(path.read_bytes()).hexdigest()[:12]
            cache=CACHE/f'{key}-{pi}.json'; CACHE.mkdir(parents=True,exist_ok=True)
            if cache.exists(): values=json.loads(cache.read_text(encoding='utf-8'))
            else:
                import numpy as np
                pix=p.get_pixmap(matrix=fitz.Matrix(1.8,1.8),alpha=False)
                values,_=ocr_engine(np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,3))
                values=values or []; cache.write_text(json.dumps(values,ensure_ascii=False),encoding='utf-8')
                print(f'OCR {path.stem} {pi+1}/{len(doc)}',flush=True)
            for box,text,confidence in values:
                xs=[pt[0]/1.8 for pt in box];ys=[pt[1]/1.8 for pt in box]
                lines.append({'text':norm(text),'box':[min(xs),min(ys),max(xs),max(ys)],'red':'','highlight':False})
        else:
            highlights=[d['rect'] for d in p.get_drawings() if d['fill'] and d['fill'][0]>.8 and d['fill'][1]>.8 and d['fill'][2]<.3]
            for a in (p.annots() or []):
                if a.type[0]==8: highlights.append(a.rect)
            for b in p.get_text('dict')['blocks']:
                for line in b.get('lines',[]):
                    s=''.join(x['text'] for x in line['spans']); rect=fitz.Rect(line['bbox'])
                    red=''.join(x['text'] for x in line['spans'] if ((x['color']>>16)&255)>180 and ((x['color']>>8)&255)<120)
                    lines.append({'text':norm(s),'box':list(rect),'red':norm(red),'highlight':any((rect&r).get_area()>rect.get_area()*.2 for r in highlights)})
        lines.sort(key=lambda r:(round(r['box'][1]/4),r['box'][0]))
        current_type='single'
        for line in lines:
            t=line['text']
            if re.match(r'^多选',t):current_type='multi'
            if re.match(r'^单选',t):current_type='single'
            line['sectionType']=current_type
            if not t or re.match(r'^(?:华为.*(?:通用|工程师|开发)|V[:：]|[0-9]{1,3}$|单选题|多选题|友情提醒|精英求职)',t):continue
            line['page']=pi+1;rows.append(line)
    return doc,rows,scanned

Q=re.compile(r'^(\d{1,3})\s*[、.．)）]\s*(.+)')
OPT=re.compile(r'^([A-H])\s*[、.．)）]\s*(.*)')
ANS=re.compile(r'(?:参考答案|正确答案|答案|解析)\s*[:：]\s*([A-H](?:[A-H、,，\s]*[A-H])?)(?=\s|$|[。.;；])')

def parse(path,doc,rows,bank_id,scanned):
    candidates=[i for i,r in enumerate(rows) if Q.match(r['text'])]
    # Explanatory numbered lists are not new questions unless they have options.
    starts=[]
    for j,i in enumerate(candidates):
        end=candidates[j+1] if j+1<len(candidates) else len(rows)
        found=[]
        for r in rows[i+1:end]:
            if re.match(r'^(参考答案|正确答案|答案|解析)\s*[:：]',r['text']):break
            m=OPT.match(r['text'])
            if m: found.append(m[1])
        if 'A' in found and 'B' in found:starts.append(i)
    questions=[];rejected=[]
    for qi,i in enumerate(starts):
        end=starts[qi+1] if qi+1<len(starts) else len(rows)
        chunk=rows[i:end];match=Q.match(chunk[0]['text']); number=int(match[1])
        body=[dict(r) for r in chunk];body[0]['text']=match[2]
        first=next((n for n,r in enumerate(body) if OPT.match(r['text'])),None)
        if first is None:continue
        stem='\n'.join(r['text'] for r in body[:first]);answer=[];source='';explanation=[];options=[];current=None;after=False
        for r in body[first:]:
            m=ANS.search(r['text'])
            if m and not answer:
                answer=sorted(set(re.findall('[A-H]',m[1])));source='PDF 参考答案（OCR）' if scanned else '原文参考答案'
            if re.match(r'^(?:参考答案|正确答案|答案|解析)\s*[:：]',r['text']):
                after=True
                if r['text'].startswith('解析'):explanation.append(r['text'])
                continue
            if after:explanation.append(r['text']);continue
            m=OPT.match(r['text'])
            if m:
                current={'key':m[1],'text':m[2]};options.append(current)
                if r['highlight']:answer.append(m[1]);source='原文高亮标记'
            elif current:current['text']+='\n'+r['text']
        red=''.join(r['red'] for r in body[:first])
        if not answer and re.fullmatch('[A-H]+',red or ' '):answer=list(red);source='原文红色标记'
        # A letter inside a blank, or a colored trailing answer, is removed from the stem.
        inline=re.search(r'[（(]\s*([A-H]{1,8})\s*[）)]',stem)
        if inline:
            if not answer:answer=list(inline[1]);source='原文题干标记'
            stem=stem[:inline.start()]+'（ ）'+stem[inline.end():]
        if red and re.fullmatch('[A-H]+',red):stem=re.sub(r'\s*'+re.escape(red)+r'\s*$','',stem)
        keys=[o['key'] for o in options]
        if len(keys)<2 or len(keys)!=len(set(keys)):
            rejected.append({'number':number,'page':chunk[0]['page'],'reason':'选项重复或缺失，保留原文件核对'});continue
        answer=sorted(set(answer))
        if any(a not in keys for a in answer):answer=[];source=''
        qid=f'{bank_id}-{qi+1:03}'
        q={'id':qid,'number':number,'stem':stem.strip(),'options':options,'answer':answer,
           'answerSource':source,'explanation':'\n'.join(explanation).strip(),'type':'multi' if len(answer)>1 or '多选' in stem else 'single',
           'pages':sorted(set(r['page'] for r in chunk)),'images':[],'ocr':scanned}
        if chunk[0].get('sectionType')=='multi':q['type']='multi'
        # Preserve circuit illustrations, including vector drawings, before the options.
        for pn in sorted(set(r['page'] for r in body[:first])):
            p=doc[pn-1]; local=[r for r in body[:first] if r['page']==pn]
            lo=local[0]['box'][1];opt=next((r for r in body[first:] if r['page']==pn and OPT.match(r['text'])),None)
            hi=opt['box'][1] if opt else p.rect.height-25
            diagram=[]
            if scanned:
                # Raster-only pages: retain the stem region, never the options/answer region.
                if hi-lo>70:diagram=[fitz.Rect(35,lo, p.rect.width-25,hi-3)]
            else:
                for b in p.get_text('dict')['blocks']:
                    if b['type']==1:
                        rect=fitz.Rect(b['bbox'])
                        if rect.y0>=lo-3 and rect.y1<=hi+2 and rect.get_area()>1200:diagram.append(rect)
                if re.search('图|电路|波形',stem):
                    ds=[d['rect'] for d in p.get_drawings() if not d['fill'] and d['rect'].y0>=lo+8 and d['rect'].y1<hi and d['rect'].get_area()>10]
                    if len(ds)>=4:
                        box=ds[0]
                        for rect in ds[1:]:box=box|rect
                        if box.height>25:diagram.append(fitz.Rect(max(25,box.x0-12),max(lo,box.y0-12),min(p.rect.width-25,box.x1+12),min(hi-2,box.y1+12)))
            for n,rect in enumerate(diagram[:3]):
                name=f'{qid}-p{pn}-{n}.png'; target=OUT/'images'/name
                p.get_pixmap(matrix=fitz.Matrix(1.7,1.7),clip=rect,alpha=False).save(target)
                q['images'].append(name)
        questions.append(q)
    return questions,rejected,len(candidates)

def screenshot_questions(doc, rows, bank_id):
    questions=[]
    for pi,p in enumerate(doc):
        images=[b for b in p.get_text('dict')['blocks'] if b['type']==1 and fitz.Rect(b['bbox']).get_area()>6000 and fitz.Rect(b['bbox']).width>p.rect.width*.32 and (bank_id=='hw20' or b['bbox'][1]<p.rect.height*.8)]
        for image in sorted(images,key=lambda b:b['bbox'][1]):
            rect=fitz.Rect(image['bbox']); local=[r for r in rows if r['page']==pi+1 and rect.contains(fitz.Rect(r['box']))]
            content=[r['text'] for r in local if not re.search(r'单选|多选|第.*题|^上.?题$|^下一题$|^存疑$|Offer|学霸|求职|专业师资|https?://|netm0_',r['text'])]
            qid=f'{bank_id}-scan-{len(questions)+1:03}';name=qid+'.png'
            p.get_pixmap(matrix=fitz.Matrix(1.8,1.8),clip=rect,alpha=False).save(OUT/'images'/name)
            stem=Q.sub(lambda m:m[2],content[0]) if content else '请阅读原图中的题目并作答'
            questions.append({'id':qid,'number':len(questions)+1,'stem':stem,'options':[{'key':'A','text':'已完成思考 / 作答'}],
                'answer':[],'answerSource':'','explanation':'原文件为拍摄截图，无可信答案。请对照原图练习；截图里的已选项不代表正确答案。',
                'type':'self','pages':[pi+1],'images':[name],'ocr':True})
    return questions

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',default='E:/华为硬件-通用、单板开发28套');args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'images').mkdir(exist_ok=True)
    from rapidocr_onnxruntime import RapidOCR
    engine=RapidOCR(intra_op_num_threads=4,inter_op_num_threads=2)
    files=list(Path(args.source).glob('*.pdf'))+list((ROOT/'tmp/quiz/converted').glob('*.pdf'))
    files=[p for p in files if re.search(r'第\d+',p.name)]
    banks=[];report=[]
    for path in sorted(files,key=lambda p:int(re.search(r'第(\d+)',p.name)[1])):
        num=int(re.search(r'第(\d+)',path.name)[1]);bank_id=f'hw{num:02}'
        doc,rows,scanned=extract(path,engine)
        if num in (19,20,21):qs=screenshot_questions(doc,rows,bank_id);rejected=[];raw=len(qs)
        else:qs,rejected,raw=parse(path,doc,rows,bank_id,scanned)
        bank={'id':bank_id,'title':f'第 {num:02} 套','sourceName':path.name,'sourcePath':str(path),'pageCount':len(doc),'questions':qs}
        (OUT/f'{bank_id}.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2),encoding='utf-8')
        banks.append({'id':bank_id,'title':bank['title'],'count':len(qs),'answered':sum(bool(q['answer']) for q in qs),'ocr':scanned})
        report.append({**banks[-1],'numberedCandidates':raw,'rejected':rejected})
        print('BANK',json.dumps(banks[-1],ensure_ascii=False),flush=True);doc.close()
    (OUT/'index.json').write_text(json.dumps({'version':1,'banks':banks},ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__': main()

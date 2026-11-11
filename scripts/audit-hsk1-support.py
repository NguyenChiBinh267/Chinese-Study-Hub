"""Targeted prerequisite references, not a replacement HSK1 course/segmentation claim."""
import json,re
from pathlib import Path
from pypdf import PdfReader
root=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((root/p).read_text('utf-8'))
pdf=PdfReader(root/'.local-postgres/source-research/hsk-2025-11.pdf')
gloss={
'我':('wǒ','tôi; chủ ngữ/người nói'),'你':('nǐ','bạn; người được nói tới'),'他':('tā','anh ấy; ngôi thứ ba'),'她':('tā','cô ấy; ngôi thứ ba'),
'我们':('wǒmen','chúng tôi/chúng ta theo ngữ cảnh'),'是':('shì','là; định danh hoặc giải thích'),'有':('yǒu','có; sở hữu hoặc tồn tại theo cấu trúc'),
'在':('zài','ở; đứng trước nơi chốn, hoặc trong mẫu diễn tả đang làm'),'不':('bù','không; phủ định theo cấu trúc, đọc bú trước âm thanh4 trong lời nói'),
'的':('de','nối thành phần bổ nghĩa/sở hữu với danh từ; khác 地/得'),'了':('le','trợ từ; phân biệt việc hoàn tất và tình huống thay đổi theo câu'),
'书':('shū','sách'),'写':('xiě','viết'),'看':('kàn','xem/đọc theo tân ngữ'),'读':('dú','đọc'),'说':('shuō','nói'),
'去':('qù','đi ra phía không phải chỗ người nói'),'来':('lái','đến phía được lấy làm điểm nhìn'),'喜欢':('xǐhuan','thích'),'想':('xiǎng','muốn/nghĩ theo ngữ cảnh'),
'会':('huì','biết làm hoặc dự đoán theo ngữ cảnh; chưa chứng nhận kỹ năng'),'可以':('kěyǐ','có thể/được phép theo ngữ cảnh'),'什么':('shénme','gì'),'哪':('nǎ','nào'),
'谁':('shéi','ai'),'怎么':('zěnme','thế nào; hỏi cách làm'),'多少':('duōshao','bao nhiêu'),'今天':('jīntiān','hôm nay'),'明天':('míngtiān','ngày mai'),
'昨天':('zuótiān','hôm qua'),'年':('nián','năm'),'月':('yuè','tháng'),'天':('tiān','ngày'),'个':('gè','lượng từ thông dụng, dùng đúng danh từ'),
'本':('běn','lượng từ cho sách/vở'),'人':('rén','người'),'吃':('chī','ăn'),'喝':('hē','uống'),'很':('hěn','phó từ mức độ; thường nối tính từ ở vị ngữ'),
}
sources={}
for page in range(79,87):
 for line in pdf.pages[page].extract_text().splitlines():
  m=re.match(r'^\s*(\d+)\s+1(?:（[^）]+）)*\s+(\S+)\s+(.+)$',line)
  if not m:continue
  word=re.sub(r'\d+$','',m[2])
  if word not in gloss:continue
  py=gloss[word][0];tail=m[3].replace(' ','').replace('’','')
  if py.replace(' ','') in tail:sources[word]={'ordinal':int(m[1]),'pdfIndex':page,'officialWritten':m[2],'reading':py}
coverage=read('docs/hsk24/coverage.json');taught={r['ordinal'] for r in coverage['vocabulary'] if r['introductionLevel']==1 and r['status']=='CONTENT_DRAFT'}
manifest=read('content/hsk24/manifest.json');cat=read('content/hsk24/catalog.json');result=[]
for l in cat['lessons']:
 m=next((m for m in manifest['packages'] if m['versionId']==l['currentVersion']),None)
 if not m:continue
 p=read('content/hsk24/'+m['file'])
 if p['alignment']['targetLevel']!=2:continue
 blocks=[b for b in p['blocks'] if b['type']=='teaching'];deps=[]
 for w,source in sources.items():
  examples=[{'blockId':b['id'],'example':b['hanzi']} for b in blocks if w in b['hanzi'] and (w not in ['我','你','他','她'] or re.search(w+r'(?!们)',b['hanzi']))]
  if examples:deps.append({'written':w,'pinyin':gloss[w][0],'conciseVietnameseSupport':gloss[w][1],'source':source,'HSK1IntroductionExists':source['ordinal'] in taught,'exampleEvidence':examples[:1],'state':'EXPLICIT_TEXT_DEPENDENCY_CANDIDATE','semanticSegmentation':'NOT_INDEPENDENTLY_REVIEWED'})
 result.append({'versionId':p['lesson']['versionId'],'refresherBlocks':[{'id':b['id'],'title':b['title'],'text':b['text']} for b in blocks if any(s in b['title'].lower() for s in ['kiến thức','nhắc','chuẩn bị','nền tảng'])],'dependencies':deps,'grantsMastery':False})
out={'scope':'Targeted HSK1 support for every current HSK2 activity; not exhaustive word segmentation or a full HSK1 course','HSK1TaughtEntries':8,'HSK1Denominator':300,'glossarySourceMatches':len(sources),'sourceUnresolvedTerms':sorted(set(gloss)-set(sources)),'lessons':result,'policy':'Each dependency has a source locator and actual teaching-block occurrence plus concise original Vietnamese support. Compound occurrence is a candidate, not proof of independent competence. Prerequisite rules and owner mastery remain unchanged.'}
(root/'docs/hsk24/hsk1-targeted-support.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(len(result),'HSK2 activities;',len(sources),'source-checked support terms; no HSK1 completion/mastery.')

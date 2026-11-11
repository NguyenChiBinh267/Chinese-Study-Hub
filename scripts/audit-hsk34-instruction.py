"""Evidence links for actual draft blocks/exercises; no educational acceptance."""
import hashlib,json,re
from pathlib import Path
from pypdf import PdfReader
import pdfplumber
root=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((root/p).read_text('utf8'))
pdf=root/'.local-postgres/source-research/hsk-2025-11.pdf';sha=hashlib.sha256(pdf.read_bytes()).hexdigest()
assert sha=='ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941'
r=PdfReader(pdf);cat=read('content/hsk24/catalog.json');m=read('content/hsk24/manifest.json');registry=read('content/hsk24/reviews.json')
current={l['currentVersion'] for l in cat['lessons']};acts=[a for a in registry['activities'] if a['versionId'] in current];actids={a['versionId'] for a in acts}
packages=[p for row in m['packages'] if (p:=read('content/hsk24/'+row['file']))['lesson']['versionId'] in current]
byid={p['lesson']['id']:p for p in packages};byversion={p['lesson']['versionId']:p for p in packages}
inputs={l['id']:l for f in (root/'content/hsk24').glob('batch*.authoring.json') for l in json.loads(f.read_text('utf8'))['lessons']}
clean=lambda s:''.join(x.strip() for x in (s or '').splitlines() if x.strip() not in ['汉','考','国','际'])
links=[]
for n in range(317,385):
 p=byid[f'L{n}'];i=inputs[p['lesson']['id']];b=next(b for b in p['blocks'] if b['id']==f'l{n}-grammar')
 indices={377:[1,2],378:[0],384:[0]}.get(n,[7]);es=[p['exercises'][j] for j in indices]
 assert b['text'] and all(e['id'] in {x['id'] for x in p['exercises']} for e in es)
 links.append({'lessonId':p['lesson']['id'],'versionId':p['lesson']['versionId'],'packageHash':p['packageHash'],'sourceReferenceId':i['grammar'][0],'scope':i['grammar'][3],'teachingBlockId':b['id'],'explanation':b['text'],'practiceExerciseIds':[e['id'] for e in es],'practicePrompts':[e['prompt'] for e in es],'state':'TAUGHT_AND_PRACTICED_DRAFT_SUBALTERNATIVE','technicalValidation':'SEE_hsk34-verification.json','humanReviewed':False,'published':False,'learnerMastered':None})
h3=read('docs/hsk24/hsk3-coverage.json')
for row in h3['grammar']:
 row['instructionEvidence']=[x for x in links if x['sourceReferenceId'] in row['sourceReferenceIds']]
 row['instructionalState']='EXPLICIT_SUBALTERNATIVE_TAUGHT_PRACTICED_DRAFT' if row['instructionEvidence'] else 'LINKED_LESSON_PARTIAL' if row['sourceReferenceIds'] else 'NOT_MAPPED'
for row in h3['topics']:
 row['textSceneEvidence']=[{'versionId':p['lesson']['versionId'],'readingBlockId':b['id'],'comprehensionExerciseId':p['exercises'][6]['id'],'state':'WRITTEN_SCENARIO_PARTIAL'} for p in packages if p['alignment']['targetLevel']==3 and p['lesson']['versionId'] not in actids and any(v['id'] in row['sourceReferenceIds'] for v in p['alignment']['topicReferences']) for b in p['blocks'] if b['type']=='teaching' and b['id'].endswith('-reading')]
sample=[]
for a in acts:
 if byversion[a['versionId']]['alignment']['targetLevel']!=3:continue
 p=byversion[a['versionId']]
 for item in a.get('characterItems',[]):
  e=next(e for e in p['exercises'] if e['id']==item['exerciseId']);key=next(k for k in p['privateKeys'] if k['id']==e['keyRef']);assert e['skill']=='recognition' and key['accepted']==[item['character']]
  assert any(v['written']==item['character'] and v['officialLevel']==3 for v in p['alignment']['characterReferences'])
  sample.append({'versionId':a['versionId'],**item,'state':'ASSISTED_GLYPH_RECOGNITION_DRAFT'})
for row in h3['characters']:
 row['practiceEvidence']=[s for s in sample if s['character']==row['character']];row['dedicatedRecognitionPractice']='ASSISTED_DRAFT' if row['practiceEvidence'] else 'NOT_ENUMERATED'
h3['summary'].update(grammarRowsWithExplicitPartialPractice=sum(bool(g['instructionEvidence']) for g in h3['grammar']),recognitionCharactersExplicitlyPracticed=len({s['character'] for s in sample}),fullyAcceptedGrammarRows=0,fullyAcceptedTaskBullets=0)
h3['reviews']={'activities':[{'versionId':a['versionId'],'kind':a['kind'],'scope':a['scope']} for a in acts if byversion[a['versionId']]['alignment']['targetLevel']==3],'exercises':sum(len(byversion[a['versionId']]['exercises']) for a in acts if byversion[a['versionId']]['alignment']['targetLevel']==3),'sampledRecognitionCharacters':len({s['character'] for s in sample}),'newVocabulary':0,'cardIdentity':'Immutable origin sense/card reused; no independent mastery'}
h3['status']='HSK3_VOCABULARY_COMPLETE / HSK3_CURRICULUM_PARTIAL' if h3['vocabulary']['taught']==500 else 'HSK3_CURRICULUM_PARTIAL'
(root/'docs/hsk24/hsk3-coverage.json').write_text(json.dumps(h3,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(root/'docs/hsk24/hsk3-instruction-evidence.json').write_text(json.dumps({'sourceSha256':sha,'scope':'68 continuation lessons; explicit linked subalternatives only. No full-row acceptance or human review.','grammarApplications':links,'characterPractice':sample},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
intro4=[p for p in packages if p['alignment']['targetLevel']==4 and p['lesson']['versionId'] not in actids]
if intro4:
 bindings={x['lessonId']:x for x in read('docs/hsk24/hsk4-grammar-row-bindings.json')['bindings']}
 assert all(p['lesson']['id'] in bindings for p in intro4), 'EXPLICIT_GRAMMAR_ROW_REQUIRED'
 refs=lambda f:[v for p in intro4 for v in p['alignment'][f] if v['status']=='VERIFIED']
 grammar=[];topics=[]
 with pdfplumber.open(pdf) as source:
  for page,count in [(394,32),(395,30),(396,33)]:
   rows=source.pages[page].extract_tables()[0][1:];assert len(rows)==count
   for n,row in enumerate(rows,1):
    cells=[clean(x) for x in row];rowid=f'g-{page}-{n}'
    ids=sorted({v['id'] for p in intro4 if bindings[p['lesson']['id']]['sourceRowId']==rowid for v in p['alignment']['grammarReferences'] if v['sourceLocator']['pdfIndex']==page and clean(v['written']) in ''.join(cells)})
    for p in intro4:
     if bindings[p['lesson']['id']]['sourceRowId']==rowid: assert any(v['id'] in ids for v in p['alignment']['grammarReferences']), ('GRAMMAR_ROW_SCOPE_MISMATCH',p['lesson']['id'],rowid)
    links4=[{'versionId':p['lesson']['versionId'],'teachingBlockId':p['lesson']['id'].lower()+'-grammar','practiceExerciseId':p['exercises'][7]['id'],'scope':'EXPLICIT_SUBALTERNATIVE_TAUGHT_PRACTICED_DRAFT','humanReviewed':False,'published':False,'learnerMastered':None} for p in intro4 if any(v['id'] in ids for v in p['alignment']['grammarReferences'])]
    grammar.append({'id':f'g-{page}-{n}','pdfIndex':page,'bodyRow':n,'sourceRowSha256':hashlib.sha256(json.dumps(cells,ensure_ascii=False).encode()).hexdigest(),'label':next(x for x in reversed(cells) if x),'sourceReferenceIds':ids,'instructionEvidence':links4,'instructionalState':'LINKED_SUBALTERNATIVE_DRAFT' if ids else 'NOT_MAPPED','fullyAccepted':False})
  for page,count in [(65,25),(66,27),(67,25)]:
   rows=source.pages[page].extract_tables()[0][1:1+count];assert len(rows)==count
   for n,row in enumerate(rows,1):
    leaf=clean(row[-1]);topics.append({'id':f'topic-{page}-{n}','pdfIndex':page,'bodyRow':n,'leaf':leaf,'sourceReferenceIds':sorted({v['id'] for v in refs('topicReferences') if v['sourceLocator']['pdfIndex']==page and clean(v['written'])==leaf}),'state':'SUBREQUIREMENTS_NOT_ACCEPTED'})
 chars={int(m[1]):m[2] for i in [360,361,362] for m in re.finditer(r'(\d+)\.\s*([\u4e00-\u9fff])',r.pages[i].extract_text())};assert len(chars)==441
 assert len(re.findall(r'\d+\.\s*[\u4e00-\u9fff]',r.pages[378].extract_text()))==150
 tasks=[];task=None;active=None;heads=[]
 def flush():
  global active
  if active:
   t=active.pop('text');active.update(requirementSha256=hashlib.sha256(t.encode()).hexdigest(),sourcePrefix=t[:32],state='SOURCE_IDENTIFIED_NOT_ACCEPTED',published=False,learnerMastered=None);tasks.append(active);active=None
 for page in range(20,31):
  for line in r.pages[page].extract_text().splitlines():
   line=line.strip();head=re.match(r'^([一二三四五六七八九十]+)、(.+)',line)
   if head:flush();task=head[1];heads.append(task);continue
   if line.startswith(''):flush();active={'task':task,'pdfIndex':page,'text':line[1:].strip()}
   elif active and line and not line.isdigit() and line!='汉考国际' and not line.startswith('HSK'):active['text']+=line
 flush();assert len(heads)==30
 ords=sorted({v['ordinal'] for p in intro4 for v in p['alignment']['vocabularyReferences'] if v['status']=='VERIFIED' and any(v['id'] in c['referenceIds'] for c in p['concepts'])})
 h4={'status':'HSK4_CURRICULUM_PARTIAL','sourceSha256':sha,'denominators':{'additionalVocabulary':1000,'grammarPhysicalRows':95,'topicLeaves':77,'taskHeads':30,'taskPhysicalBullets':len(tasks),'recognitionCharacters':441,'writingCharacters':150},'vocabulary':{'taught':len(ords),'ordinals':ords,'remainingOrdinals':[n for n in range(1001,2001) if n not in ords]},'lessonVersions':[p['lesson']['versionId'] for p in intro4],'exercises':sum(len(p['exercises']) for p in intro4),'grammar':grammar,'topics':topics,'taskSubrequirements':tasks,'recognition':[{'ordinal':n,'character':c,'mapped':any(v['ordinal']==n for v in refs('characterReferences')),'dedicatedPractice':False} for n,c in sorted(chars.items())],'writing':{'pdfIndex':378,'denominator':150,'handwritingAssessment':'UNSUPPORTED'},'summary':{'grammarRowsMappedCandidates':sum(bool(g['sourceReferenceIds']) for g in grammar),'topicLeavesMapped':sum(bool(t['sourceReferenceIds']) for t in topics),'taskHeadsReferenced':len({v['sourceLocator']['entry'] for v in refs('taskReferences')}),'recognitionCharacterRefs':len({v['ordinal'] for v in refs('characterReferences')})},'stages':{'mapped':'See exact references','taughtPracticed':f'{len(intro4)} actual written introductions; see explicit links, not full-row acceptance','technicalValidation':'SEE_hsk34-verification.json','qualifiedHumanReview':False,'published':False,'learnerMastered':None},'modalities':{'listening':'UNSUPPORTED','speakingAssessment':'UNSUPPORTED','handwriting':'UNSUPPORTED','freeWritingScoring':'UNSUPPORTED','boundedTypedResponses':'DETERMINISTIC_DRAFT'}}
 (root/'docs/hsk24/hsk4-coverage.json').write_text(json.dumps(h4,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('HSK4',h4['summary'],'tasks',len(tasks))
print('HSK3',h3['summary'],'reviews',len(h3['reviews']['activities']))

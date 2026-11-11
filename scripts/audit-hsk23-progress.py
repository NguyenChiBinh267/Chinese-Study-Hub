"""Local pinned-source reconciliation. Source rows != educational acceptance."""
import hashlib,json,re
from pathlib import Path
from functools import lru_cache
from pypdf import PdfReader
import pdfplumber
root=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((root/p).read_text('utf-8'))
pdf=root/'.local-postgres/source-research/hsk-2025-11.pdf'
sha=hashlib.sha256(pdf.read_bytes()).hexdigest()
assert sha=='ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941'
reader=PdfReader(pdf)
@lru_cache(None)
def text(i):return reader.pages[i].extract_text()
manifest=read('content/hsk24/manifest.json');cat=read('content/hsk24/catalog.json');registry=read('content/hsk24/reviews.json')
current={l['currentVersion'] for l in cat['lessons']}
packages=[p for m in manifest['packages'] if (p:=read('content/hsk24/'+m['file']))['lesson']['versionId'] in current]
activities=[a for a in registry['activities'] if a['versionId'] in current]
byversion={p['lesson']['versionId']:p for p in packages}
def clean(s):return ''.join(x.strip() for x in (s or '').splitlines() if x.strip() not in ['汉','考','国','际'])
def body(level):
 result=[];task=None;active=None
 def flush():
  nonlocal active
  if active:
   t=active.pop('text');active['requirementSha256']=hashlib.sha256(t.encode()).hexdigest();active['sourcePrefix']=t[:32];active['modalities']=(['LISTENING'] if '听' in t else [])+(['WRITING'] if '写' in t or '填' in t else [])+(['READING'] if '看懂' in t or '读' in t else [])+(['ORAL_INTERACTION'] if any(x in t for x in ['询问','回答','讲述','介绍','表述','互致','表达']) and not any(x in t for x in ['听懂','看懂','写出','读懂']) else []);result.append(active);active=None
 for page in (range(8,13) if level==2 else range(13,20)):
  for line in text(page).splitlines():
   line=line.strip()
   h=re.match(r'^([一二三四五六七八九十]+)、(.+)',line)
   if h:flush();task=h[1];continue
   if line.startswith(''):
    flush();n=1+sum(r['task']==task for r in result);active={'id':f'h{level}-task-{task}-bullet-{n}','task':task,'pdfIndex':page,'physicalPage':page+1,'bulletWithinTask':n,'text':line[1:].strip()}
   elif active and line and not line.isdigit() and line!='汉考国际' and not line.startswith('HSK'):active['text']+=line
 flush();assert len(result)==(76 if level==2 else 109),(level,len(result));return result
old=read('docs/hsk24/five-dimensions.json')
known={'g-388-2':[('l225-draft-v1',['l225-t0','l225-t1'],['l225-v1-e0','l225-v1-e1'],'LEXICAL_RECALL_PARTIAL')],'g-388-6':[('l218-draft-v1',['l218-t0'],['l218-v1-e0'],'LEXICAL_RECALL_PARTIAL')],'g-388-13':[('l230-draft-v1',['l230-t2'],['l230-v1-e2'],'LEXICAL_RECALL_PARTIAL')],'g-388-30':[('l221-draft-v2',['l221-t2','l221-t3'],['l221-v2-e2','l221-v2-e3','l221-v2-e7'],'PARTIAL_CONTEXT')],'g-388-31':[('l232-draft-v1',['l232-t4'],['l232-v1-e4'],'PINYIN_RECALL_NOT_USAGE')],'g-390-9':[('l232-draft-v1',['l232-t4'],['l232-v1-e4'],'PINYIN_RECALL_NOT_USAGE')],'g-390-5':[('l215-draft-v2',['l215-grammar'],['l215-v2-e7'],'PARTIAL_CONTEXT')]}
for row in old['grammar']:
 evidence=[]
 row['existingCandidateEvidence']=[]
 for mapped in row['mappedEvidence']:
  if mapped['versionId'] not in byversion:continue
  p=byversion[mapped['versionId']];blocks=[b for b in p['blocks'] if b['type']=='teaching' and b['id'].endswith('-grammar')]
  row['existingCandidateEvidence'].extend({'versionId':p['lesson']['versionId'],'blockId':b['id'],'explanation':b['text'],'exerciseCandidate':p['exercises'][-1]['id'],'scopeState':'ACTUAL_TEXT_LINKED_SUBALTERNATIVES_NEED_REVIEW'} for b in blocks)
 for v,bs,es,scope in known.get(row['id'],[]):
  if v not in byversion:continue
  p=byversion[v];assert all(any(b['id']==i for b in p['blocks']) for i in bs);assert all(any(e['id']==i for e in p['exercises']) for i in es)
  evidence.append({'versionId':v,'teachingBlocks':bs,'exerciseIds':es,'scope':scope})
 for a in activities:
  for g in a.get('grammarEvidence',[]):
   if g['rowId']==row['id']:
    p=byversion[a['versionId']];assert any(b['id']==g['teachingBlockId'] for b in p['blocks']);assert any(e['id']==g['exerciseId'] for e in p['exercises']);evidence.append({'versionId':a['versionId'],**g})
 row['instructionEvidence']=evidence;row['instructionalState']='SUBALTERNATIVE_TAUGHT_PRACTICED_DRAFT' if any(x.get('state')=='TAUGHT_AND_CONTEXT_PRACTICE_DRAFT' for x in evidence) else 'EXISTING_TEACHING_PARTIAL' if evidence else 'UNVERIFIED';row['independentLanguageReview']=False;row['published']=False;row['learnerMastered']=None
for row in old['topics']:
 row['textScenarioEvidence']=[{'versionId':a['versionId'],**t} for a in activities for t in a.get('topicEvidence',[]) if t['id']==row['id']];row['instructionalState']='TEXT_SCENARIO_DRAFT_PARTIAL' if row['textScenarioEvidence'] else 'UNVERIFIED_SUBREQUIREMENTS'
tasks=body(2)
for r in tasks:
 r['state']='UNSUPPORTED_AUDIO' if 'LISTENING' in r['modalities'] else 'UNSUPPORTED_ORAL_ASSESSMENT' if 'ORAL_INTERACTION' in r['modalities'] else 'TEXT_SUBREQUIREMENT_NOT_ACCEPTED';r['published']=False;r['learnerMastered']=None
h2={'status':'HSK2_CURRICULUM_PARTIAL','sourceSha256':sha,'vocabulary':{'taught':200,'denominator':200,'newInClosure':0},'denominators':{'grammarTableRows':78,'topicLeaves':34,'tasks':17,'taskPhysicalBullets':76,'recognitionCharacters':125,'writingCharactersHSK1And2':100},'grammar':old['grammar'],'topics':old['topics'],'taskSubrequirements':tasks,'recognition':{'explicitlyPracticed':125,'reviewed':0},'writing':{'pdfIndex':376,'denominator':100,'handwritingAssessment':'UNSUPPORTED','typedTextIsNotHandwriting':True},'reviewAudit':{'unitReviews':34,'diagnostics':16,'scope':'Assisted retrieval/recognition and reused context, not comprehensive transfer diagnostics','newTransferActivities':[a['versionId'] for a in activities if a['kind']=='GAP_CONTEXT'],'FSRS':'Provisional reminder eligibility from taught context; grammar answers are not sense-specific vocabulary mastery; independentEvidence remains false.'},'audioSpeaking':{'reviewedNativeAudio':False,'speakingGrader':False,'browserTTS':'Optional synthetic zh-CN reference only where existing UI exposes it; not native reviewed audio or listening evidence.'},'summary':{'rowsWithExplicitTeachingEvidence':sum(bool(r['instructionEvidence']) for r in old['grammar']),'rowsWithNewContextPractice':sum(r['instructionalState']=='SUBALTERNATIVE_TAUGHT_PRACTICED_DRAFT' for r in old['grammar']),'newTransferExercises':sum(len(byversion[a['versionId']]['exercises']) for a in activities if a['kind']=='GAP_CONTEXT'),'newTopicTextScenarios':sum(bool(r['textScenarioEvidence']) for r in old['topics']),'sourceTopicLeavesMapped':len({r['id'] for r in old['topics'] if r['mappedEvidence'] or r['textScenarioEvidence']}),'fullyAcceptedGrammarRows':0,'fullyAcceptedTaskBullets':0},'remainingGrammarRows':[r['id'] for r in old['grammar'] if not r['instructionEvidence']],'remainingPolicy':'Even rows with evidence retain untested subalternatives until independently accepted.'}
assert len(re.findall(r'\d+\.\s*[\u4e00-\u9fff]',text(376)))==100
(root/'docs/hsk24/hsk2-reconciliation.json').write_text(json.dumps(h2,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
def refs(level,field):return [v for p in packages if p['alignment']['targetLevel']==level for v in p['alignment'][field] if v['status']=='VERIFIED']
g3=[];topics3=[]
with pdfplumber.open(pdf) as source:
 for page,count in [(391,31),(392,33),(393,32)]:
  rows=source.pages[page].extract_tables()[0][1:];assert len(rows)==count
  for n,row in enumerate(rows,1):
   cells=[clean(x) for x in row];label=next(x for x in reversed(cells) if x);mapped=[v['id'] for v in refs(3,'grammarReferences') if v['sourceLocator']['pdfIndex']==page and clean(v['written']) in ''.join(cells)]
   g3.append({'id':f'g-{page}-{n}','pdfIndex':page,'bodyRow':n,'sourceRowSha256':hashlib.sha256(json.dumps(cells,ensure_ascii=False).encode()).hexdigest(),'label':label,'sourceReferenceIds':sorted(set(mapped)),'instructionalState':'LINKED_LESSON_PARTIAL' if mapped else 'NOT_MAPPED','languageReviewed':False,'published':False,'learnerMastered':None})
 for page,count in [(62,25),(63,25),(64,4)]:
  rows=source.pages[page].extract_tables()[0][1:1+count]
  for n,row in enumerate(rows,1):
   leaf=clean(row[-1]);topics3.append({'id':f'topic-{page}-{n}','pdfIndex':page,'bodyRow':n,'leaf':leaf,'sourceReferenceIds':sorted({v['id'] for v in refs(3,'topicReferences') if v['sourceLocator']['pdfIndex']==page and clean(v['written'])==leaf}),'instructionalState':'UNVERIFIED_SUBREQUIREMENTS','languageReviewed':False,'published':False,'learnerMastered':None})
chars={int(m[1]):m[2] for i in [358,359] for m in re.finditer(r'(\d+)\.\s*([\u4e00-\u9fff])',text(i))};assert len(chars)==284
assert len(re.findall(r'\d+\.\s*[\u4e00-\u9fff]',text(377)))==150
activity_ids={a['versionId'] for a in activities}
intro3=[p for p in packages if p['alignment']['targetLevel']==3 and p['lesson']['versionId'] not in activity_ids];vocab=sorted({v['ordinal'] for p in intro3 for v in p['alignment']['vocabularyReferences'] if v['status']=='VERIFIED' and any(v['id'] in c['referenceIds'] for c in p['concepts'])})
h3={'status':'HSK3_CURRICULUM_PARTIAL','sourceSha256':sha,'denominators':{'additionalVocabulary':500,'cumulativeVocabulary':1000,'grammarTableRows':96,'topicLeaves':54,'taskHeads':22,'taskPhysicalBullets':109,'recognitionCharacters':284,'writingCharacters':150},'vocabulary':{'taught':len(vocab),'ordinals':vocab,'remainingOrdinals':[n for n in range(501,1001) if n not in vocab]},'lessonVersions':[p['lesson']['versionId'] for p in intro3],'exercises':sum(len(p['exercises']) for p in intro3),'grammar':g3,'topics':topics3,'tasks':body(3),'characters':[{'ordinal':n,'character':c,'mapped':any(v['ordinal']==n for v in refs(3,'characterReferences')),'dedicatedRecognitionPractice':'NOT_ENUMERATED','handwriting':'NOT_ASSESSED'} for n,c in sorted(chars.items())],'writing':{'pdfIndex':377,'denominator':150,'handwritingAssessment':'UNSUPPORTED'},'summary':{'vocabularyTaught':len(vocab),'grammarRowsMappedCandidates':sum(bool(r['sourceReferenceIds']) for r in g3),'topicLeavesMapped':sum(bool(r['sourceReferenceIds']) for r in topics3),'taskHeadsReferenced':len({(v['sourceLocator']['pdfIndex'],v['sourceLocator']['entry']) for v in refs(3,'taskReferences')}),'recognitionCharacterRefs':len({v['ordinal'] for v in refs(3,'characterReferences')}),'qualifiedHumanReviews':0},'stages':{'sourceIdentified':True,'mapping':'See rows','teachingAndPractice':'See immutable lesson/exercise links, not reference count','technicalValidation':'Recorded separately in milestone verification','independentLanguageReview':False,'published':False,'learnerMastered':None}}
for row in h3['tasks']:
 row['mappedLessonVersions']=sorted({p['lesson']['versionId'] for p in intro3 if any(v['sourceLocator']['entry'].split(' / ')[0]==row['task'] for v in p['alignment']['taskReferences'] if v['status']=='VERIFIED')})
 row['state']='UNSUPPORTED_AUDIO_ASSESSMENT' if 'LISTENING' in row['modalities'] else 'UNSUPPORTED_ORAL_ASSESSMENT' if 'ORAL_INTERACTION' in row['modalities'] else 'SOURCE_IDENTIFIED_NOT_ACCEPTED'
 row['mappingMeaning']='Parent task linkage only; no acceptance of this physical bullet or all its subclauses.'
 row['independentLanguageReview']=False;row['published']=False;row['learnerMastered']=None
h2['knownFalsePositiveMappings']=[{'topicId':'topic-60-20','versionId':'l227-draft-v1','limitation':'Body/hygiene/washroom content is not a doctor-consultation lesson. This source mapping does not prove the medical-visit topic taught.'}]
(root/'docs/hsk24/hsk2-reconciliation.json').write_text(json.dumps(h2,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
assert len(topics3)==54
(root/'docs/hsk24/hsk3-coverage.json').write_text(json.dumps(h3,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print('HSK2',h2['summary']);print('HSK3',h3['summary'])

"""Derive resumable local production state; never grant review/publication/mastery."""
import json,re,hashlib,sys,subprocess
from pathlib import Path
read=lambda p:json.loads(Path(p).read_text('utf8'))
digest=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
batch=int(sys.argv[1]);log=sys.argv[2]
text=Path(log).read_text('utf8');counts={k:int(re.search(r'(?:ℹ|#) '+k+r' (\d+)\b',text)[1]) for k in ['tests','pass','fail','skipped']}
assert counts['pass']>0 and counts['fail']==counts['skipped']==0
cat=read('content/hsk24/catalog.json');man=read('content/hsk24/manifest.json');reviews=read('content/hsk24/reviews.json')
curr={l['currentVersion'] for l in cat['lessons']};rev={a['versionId'] for a in reviews['activities']}
packages=[p for r in man['packages'] if r['versionId'] in curr and (p:=read('content/hsk24/'+r['file']))['alignment']['targetLevel']==4]
intros=[p for p in packages if p['lesson']['versionId'] not in rev]
ords=[v['ordinal'] for p in intros for v in p['alignment']['vocabularyReferences'] if any(v['id'] in c['referenceIds'] for c in p['concepts'])]
assert len(ords)==len(set(ords))==batch*24
before=read('.local-postgres/hsk24/hsk4-continuous-before.json');pointer=read('.local-postgres/hsk24/current.json');state=read(pointer['stateFile']);assert state['database']==before['database']=='csh_hsk24_bf294b6506c1'
ids=lambda b: [f'L{n}' for n in (range(401+(b-1)*4,405+(b-1)*4) if b<=20 else range(489,493) if b==21 else range(4001+(b-22)*4,4005+(b-22)*4))]
file=Path('docs/hsk24/hsk4-continuous-checkpoint.json');old=read(file) if file.exists() else {'acceptedBatches':[]}
entry={'batch':batch,'descriptor':f'content/hsk24/batch{30+batch}.authoring.json','sqlLog':log,'sqlCounts':counts,'sqlLogSha256':digest(log),'sourceCommitBeforeAcceptance':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()}
entry['descriptorSha256']=digest(entry['descriptor'])
entry['catalogSha256']=digest('content/hsk24/catalog.json');entry['manifestSha256']=digest('content/hsk24/manifest.json')
out={'status':'HSK4_PARTIAL / DRAFT_UNREVIEWED / PUBLICATION_BLOCKED','baseline':'ff2b46c9d7bdee9d29b29e0563c4c60be5e6d1dd','database':state['database'],'completedBatch':batch,'introductionLessons':len(intros),'reviews':len(packages)-len(intros),'exercises':sum(len(p['exercises']) for p in packages),'vocabularyTaught':len(ords),'denominator':1000,'acceptedBatches':[e for e in old['acceptedBatches'] if e['batch']!=batch]+[entry],'nextBatch':batch+1,'nextLessonIds':ids(batch+1),'nextAuthoringFile':f'content/hsk24/batch{31+batch}.authoring.json','remainingOrdinals':[n for n in range(1001,2001) if n not in ords],'qualifiedHumanReview':False,'mastery':None,'preservationBaseline':'.local-postgres/hsk24/hsk4-continuous-before.json','namespace':'L481–488 reserved for existing reviews; batch21 uses L489–492. Further allocation requires explicit collision check, never replacement.'}
file.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
nextp={'status':out['status'],'nextHSK4Batch':batch+1,'authoringFileToCreate':out['nextAuthoringFile'],'targetLessonIds':out['nextLessonIds'],'allRemainingHSK4Ordinals':out['remainingOrdinals'],'exactSelectedOrdinals':[],'selectionState':'NEXT_COHERENT_GROUPS_TO_BE_SELECTED_FROM_EXACT_COMPLEMENT','database':state['database'],'preservationBaseline':out['preservationBaseline'],'coverageMatrix':'docs/hsk24/hsk4-coverage.json','instructionEvidence':'docs/hsk24/hsk4-instruction-evidence.json','namespaceRisk':out['namespace'],'qualifiedHumanReview':False,'publicationStatus':'BLOCKED','noAutomaticPrerequisiteMastery':True}
Path('docs/hsk24/hsk4-production-next-checkpoint.json').write_text(json.dumps(nextp,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Batch{batch}: {len(ords)}/1000; next {ids(batch+1)}; SQL {counts}')

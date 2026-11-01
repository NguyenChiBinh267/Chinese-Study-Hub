"""Derived local curriculum checkpoint after a real import and focused SQL pass.
Does not edit Master Plan task status or attest human acceptance.
"""
import json,re,sys,runpy,hashlib,datetime,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((root/p).read_text('utf-8-sig'))
write=lambda p,o:(root/p).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
batch=int(sys.argv[1]);assert 28<=batch<=42
focus=sys.argv[2].split(',');cat=read('content/hsk24/catalog.json');man=read('content/hsk24/manifest.json')
versions={l['key']:l['currentVersion'] for l in cat['lessons']}
log=f'.local-postgres/hsk24/hsk4-vocabulary-batch{batch}-sql.log';text=(root/log).read_text('utf8')
assert all(re.search(r'(?:ℹ|#) '+k+r' '+str(v)+r'\b',text) for k,v in [('pass',len(focus)+4),('fail',0),('skipped',0)]),'SQL_GATE'
ledgerPath='docs/hsk24/hsk4-vocabulary-run-checkpoint.json'
ledger=read(ledgerPath) if (root/ledgerPath).exists() else {'baseline':'c5e557fde345f1efebba6952fdbbff50d975cba3','database':'csh_hsk24_bf294b6506c1','completedBatches':[],'validatedVersions':[],'batchEvidence':[]}
assert batch not in ledger['completedBatches']
assert batch==28 or batch-1 in ledger['completedBatches']
ledger['completedBatches'].append(batch);ledger['validatedVersions']+= [versions[x] for x in focus]
ledger['batchEvidence'].append({'batch':batch,'focusedIds':focus,'sqlLog':log,'sqlLogSha256':hashlib.sha256((root/log).read_bytes()).hexdigest(),'pass':len(focus)+4,'fail':0,'skip':0})
write(ledgerPath,ledger)
runpy.run_path(str(root/'scripts/audit-hsk4-vocabulary-production.py'))
h=read('docs/hsk24/hsk4-coverage.json');plan=read('docs/hsk24/hsk4-vocabulary-completion-plan.json')['lessons']
current=set(versions.values());reg=read('content/hsk24/reviews.json');acts={a['versionId']:a for a in reg['activities']}
ps=[read('content/hsk24/'+r['file']) for r in man['packages'] if r['versionId'] in current]
intro=[p for p in ps if p['lesson']['versionId'] not in acts];h4=[p for p in ps if p['alignment']['targetLevel']==4]
ordinals=h['vocabulary']['ordinals'];assert len(ordinals)==648+sum(len(x['ordinals']) for x in plan if x['batch']<=batch)
remaining=h['vocabulary']['remainingOrdinals'];nextRows=[x for x in plan if x['batch']==batch+1]
nextp={'status':'HSK4_VOCABULARY_COMPLETE / HSK4_CURRICULUM_PARTIAL' if not remaining else 'HSK4_PARTIAL','nextHSK4Batch':batch+1 if remaining else None,'authoringFileToCreate':f'content/hsk24/batch{batch+31}.authoring.json' if remaining else None,'targetLessonIds':[x['lessonId'] for x in nextRows],'groups':nextRows,'exactSelectedOrdinals':[n for x in nextRows for n in x['ordinals']],'allRemainingHSK4Ordinals':remaining,'vocabularyTaught':len(ordinals),'database':ledger['database'],'namespaceImplemented':True,'qualifiedHumanReview':False,'publicationStatus':'BLOCKED','noAutomaticPrerequisiteMastery':True,'nextAudit':'HSK1–4 evidence-based gap audit; no HSK1 rewrite','runtimeGate':'Today full-body scan removed; metadata parse and dev cache/transport limits remain','preservationBaseline':'.local-postgres/hsk24/hsk4-vocabulary-final-20261029-before.json'}
assert set(nextp['exactSelectedOrdinals'])<=set(remaining)
write('docs/hsk24/hsk4-production-next-checkpoint.json',nextp)
c=read('docs/hsk24/checkpoint.json');h4intro=[p for p in h4 if p['lesson']['versionId'] not in acts];h4rev=[p for p in h4 if p['lesson']['versionId'] in acts]
c.update(completedBatch=f'HSK4-batch{batch}',lessons=sorted(current),currentRunBaseCommit=ledger['baseline'],newBatchesThisContinuation=batch-27,newHSK4BatchesThisContinuation=batch-27,currentIntroductionLessonCount=len(intro),currentExpandedLessonCount=len(ps),currentLessonCount=len(ps),currentExpandedExerciseCount=sum(len(p['exercises']) for p in ps),currentExerciseCount=sum(len(p['exercises']) for p in ps),historicalVersionCount=len(man['packages'])-len(ps),historicalExpansionVersionCount=len(man['packages'])-len(ps),HSK4LessonCount=len(h4intro),HSK4ExerciseCount=sum(len(p['exercises']) for p in h4intro),HSK4ReviewActivityCount=len(h4rev),HSK4ReviewExerciseCount=sum(len(p['exercises']) for p in h4rev),nextBatchFile=nextp['authoringFileToCreate'],nextBatchToAuthor=f'HSK4-batch{batch+1}' if remaining else 'HSK1–4 gap audit only',verification=ledgerPath,nextCheckpoint='docs/hsk24/hsk4-production-next-checkpoint.json',latestMilestoneFinalizer='checkpoint-hsk4-vocabulary.py; final review not yet granted',independentFinalTechnicalReview='PENDING_CURRENT_RUN',technicalReviewReceipt=None,closureReady=False)
c['completedBatches']=list(dict.fromkeys(c['completedBatches']+[f'HSK4-batch{batch}']))
c['coverageVocabulary']['HSK4']=len(ordinals);c['remainingNewVocabulary']['HSK4']=len(remaining);c['pendingVocabularyOrdinals']['HSK4']=remaining;c['currentMilestones']['HSK4Vocabulary']=nextp['status']
currentacts=[a for a in reg['activities'] if a['versionId'] in current];c['unitReviewCount']=sum(a['kind']=='UNIT_REVIEW' for a in currentacts);c['diagnosticCount']=sum(a['kind'].endswith('DIAGNOSTIC') for a in currentacts)
write('docs/hsk24/checkpoint.json',c)
print('CHECKPOINT',batch,len(ordinals),'vocabulary;',len(h4),'activities;',len(remaining),'remain; no human/publication approval')

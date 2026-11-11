"""Milestone-specific delivery, derived from real bytes/logs; never self-approve."""
import datetime,hashlib,json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
baseline='4fab1cc1d3697bdc1d58b843204e47f6415dcaf4'
source='094998b3ec0d72ca48be385824cd7b5f9aa49bd7'
runtime='094998b3ec0d72ca48be385824cd7b5f9aa49bd7'
content_freeze='558b83c49727564a55fa07f63bbc11492356d3a4'
git=lambda *a:subprocess.check_output(['git',*a],cwd=root)
read=lambda p:json.loads((root/p).read_text('utf8'))
def sha(p,tracked=False):
 b=(root/p).read_bytes();return hashlib.sha256(b.replace(b'\r\n',b'\n') if tracked else b).hexdigest()
def write(p,obj):
 (root/p).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def node(path,expected,failed=0):
 text=(root/path).read_text('utf8');values={k:int(re.search(r'(?:ℹ|#) '+k+r' (\d+)\b',text)[1]) for k in ['tests','pass','fail','skipped']}
 assert values=={'tests':expected,'pass':expected-failed,'fail':failed,'skipped':0},(path,values)
 return {'path':path,'sha256':sha(path),**values}
def browser(path,expected):
 s=read(path)['stats'];assert (s['expected'],s['unexpected'],s['flaky'],s['skipped'])==(expected,0,0,0),(path,s)
 return {'path':path,'sha256':sha(path),'pass':expected,'fail':0,'flaky':0,'skipped':0}
cat=read('content/hsk24/catalog.json');m=read('content/hsk24/manifest.json');evidence=read('content/hsk24/evidence.json');registry=read('content/hsk24/reviews.json')
current={x['currentVersion'] for x in cat['lessons']};activityids={a['versionId'] for a in registry['activities']}
packages=[read('content/hsk24/'+x['file']) for x in m['packages']];selected=[p for p in packages if p['lesson']['versionId'] in current]
h4=read('docs/hsk24/hsk4-coverage.json');h3=read('docs/hsk24/hsk3-coverage.json');coverage=read('docs/hsk24/coverage.json')
assert h4['vocabulary']['taught']==216 and len(h4['lessonVersions'])==36 and h4['exercises']==288
assert len(h4['reviews']['activities'])==8 and h4['reviews']['exercises']==64
assert h4['summary']['recognitionCharactersExplicitlyPracticed']==47 and h4['summary']['recognitionPracticeExercises']==57
assert h4['stages']['technicallyValidated'] is True
assert len(m['packages'])==289 and len(selected)==234 and sum(len(p['exercises']) for p in selected)==1872
oldm=json.loads(git('show',baseline+':content/hsk24/manifest.json'));olde=json.loads(git('show',baseline+':content/hsk24/evidence.json'))
for x in oldm['packages']:
 assert x in m['packages'];assert git('show',baseline+':content/hsk24/'+x['file']).replace(b'\r\n',b'\n')==(root/'content/hsk24'/x['file']).read_bytes().replace(b'\r\n',b'\n'),x['file']
for x in olde['references']:assert x in evidence['references'],x['id']
protected=['AGENTS.md','docs/master-plan','docs/implementation','docs/engineering-loop','supabase/migrations','content/releases/trusted.json','src/modules/auth','src/app/api/v1','package.json','package-lock.json']
assert not git('diff','--name-only',baseline,'--',*protected).strip(),'PROTECTED_PATH_CHANGED'
runtime_delta=git('diff','--name-only',content_freeze,source,'--','src','content','supabase','next.config.ts').decode().splitlines()
assert runtime_delta==['src/modules/content/infrastructure/postgres-content.ts'],'UNEXPECTED_RUNTIME_DELTA'
checks=read('.local-postgres/hsk24/hsk4-production-code-checks.json');proofchecks=read('.local-postgres/hsk24/hsk4-production-proof-checks.json')
assert all(checks[k]==0 for k in ['typecheckExit','lintExit','buildExit'])
assert all(proofchecks[k]==0 for k in ['typecheckExit','lintExit','unitExit'])
tests={'unit':node('.local-postgres/hsk24/hsk4-production-unit.log',120),'all44HSK4ActivitiesPlusSharedSQL':node('.local-postgres/hsk24/hsk4-production-all-sql.log',48),'boundedFoundationLibrarySQL':node('.local-postgres/hsk24/hsk4-production-library-sql.log',3),'postLibraryHSK4RegressionSQL':node('.local-postgres/hsk24/hsk4-production-post-library-sql.log',6),'HSK2RegressionSQL':node('.local-postgres/hsk24/hsk4-production-hsk2-sql.log',8),'HSK3RegressionSQL':node('.local-postgres/hsk24/hsk4-production-hsk3-sql.log',8),'all234ManifestResumeSQL':node('.local-postgres/hsk24/hsk4-production-manifest-sql.log',1),'journeyDesktopAnd360':browser('.local-postgres/hsk24/hsk4-production-browser.json',10),'TodayDesktopAnd360':browser('.local-postgres/hsk24/hsk4-production-today-browser.json',2),'courseUnitNavigationDesktopAnd360':browser('.local-postgres/hsk24/hsk4-production-navigation-browser.json',4)}
batchtests=[node(f'.local-postgres/hsk24/hsk4-batch{n}-sql.log',10 if n in [6,8,9] else 8) for n in range(2,10)]
repairs=[node('.local-postgres/hsk24/'+n+'.log',count) for n,count in [('hsk4-reviews4-sql',6),('hsk4-refinement-sql',11),('hsk4-alternative-sql',5),('hsk4-forms-sql',5),('hsk4-travel-sql',6),('hsk4-final-batch-refinement-sql',6)]]
initial=node('.local-postgres/hsk24/hsk4-production-initial-all-sql.log',48,1)
negative=read('.local-postgres/hsk24/hsk4-advance-negative.json');assert negative['passed'] and negative['cases']==6
prod=read('.local-postgres/hsk24/hsk4-production-client-isolation.json');dev=read('.local-postgres/hsk24/hsk4-production-dev-client-isolation.json')
assert prod['passed'] and dev['passed'] and prod['markerHits']==dev['markerHits']==0 and prod['privateKeyIdsChecked']==dev['privateKeyIdsChecked']==2312
before=read('.local-postgres/hsk24/hsk4-production-before.json');after=read('.local-postgres/hsk24/hsk4-production-after.json');assert before['database']==after['database']=='csh_hsk24_bf294b6506c1'
for table,rows in before['tables'].items():
 for key,value in rows.items():assert after['tables'][table].get(key)==value,(table,key)
imports=[]
names=[f'hsk4-batch{n}-import.log' for n in range(2,10)]+['hsk4-reviews4-import.log','hsk4-refinement-import.log','hsk4-alternative-import.log','hsk4-forms-import.log','hsk4-travel-import.log','hsk4-final-batch-refinement-import.log','hsk4-skill-tags-import.log']
for name in names:
 path='.local-postgres/hsk24/'+name;obj=json.loads(next(x for x in reversed((root/path).read_text('utf8').splitlines()) if x.startswith('{')));assert obj['database']==before['database'];imports.append({'path':path,'sha256':sha(path),'result':obj})
counts=lambda x:{k:len(v) for k,v in x['tables'].items()}
groups=[{'theme':'Progress, courage and encouragement','ordinals':[1079,1082,1197,1223,1265,1269]},{'theme':'Holiday, scenery and climate','ordinals':[1170,1205,1182,1204,1285,1286]},{'theme':'Road and connecting transport','ordinals':[1159,1254,1255,1238,1306,1289]},{'theme':'Workplace and shared work','ordinals':[1250,1256,1257,1234,1259,1258]}]
remaining=h4['vocabulary']['remainingOrdinals'];assert len(remaining)==784 and all(n in remaining for g in groups for n in g['ordinals'])
assert len({n for g in groups for n in g['ordinals']})==24
checkpoint={'status':'HSK4_PARTIAL / HSK24_EPIC_PARTIAL','nextHSK4Batch':10,'authoringFileToCreate':'content/hsk24/batch40.authoring.json','targetLessonIds':['L437','L438','L439','L440'],'groups':groups,'exactSelectedOrdinals':[n for g in groups for n in g['ordinals']],'allRemainingHSK4Ordinals':remaining,'remainingHSK3VocabularyOrdinals':[],'database':before['database'],'preservationBaseline':'.local-postgres/hsk24/hsk4-production-before.json','coverageMatrix':'docs/hsk24/hsk4-coverage.json','instructionEvidence':'docs/hsk24/hsk4-instruction-evidence.json','remainingGrammarRowsWithoutExplicitPartialPractice':[r['id'] for r in h4['grammar'] if not any(x['practiceExerciseIds'] for x in r['instructionEvidence'])],'remainingTopicLeafIds':[r['id'] for r in h4['topics'] if not r['sourceReferenceIds']],'remainingRecognitionGlyphOrdinals':[r['ordinal'] for r in h4['recognition'] if not r['dedicatedPractice']],'legacyShallowGrammarOrdering':h4['legacyShallowGrammarOrdering'],'namespaceRisk':'Reconcile ID allocation before reaching L481: L481-L488 are already reviews, and the current three-digit L4xx/UUID convention cannot hold all1000 entries at six per introduction. NextL437-L440 are valid; no namespace rewrite performed.','noAutomaticPrerequisiteMastery':True,'qualifiedHumanReview':False,'publicationStatus':'BLOCKED'}
write('docs/hsk24/hsk4-production-next-checkpoint.json',checkpoint)
tracked=['docs/hsk24/coverage.json','docs/hsk24/hsk4-coverage.json','docs/hsk24/hsk4-instruction-evidence.json','docs/hsk24/hsk4-production-performance.json','docs/hsk24/hsk4-production-next-checkpoint.json']
report={'schemaVersion':1,'status':checkpoint['status'],'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'branch':'feat/hsk24-curriculum','baseline':baseline,'evidenceSourceCommit':source,'appContentRuntimeCommit':runtime,'contentFrozenCommit':content_freeze,'perEvidenceSources':{'all44HSK4SQL':'0a0beb9e1da8ad93f9520282e1494408eba2b812','libraryBoundsAndPostLibrarySQL':source,'unitAndFinalBuild':source,'journeyAndTodayBrowser':'300c622034b859680b7c7abc5d1199a1be2177c0','navigationBrowser':source},'laterSourceDeltas':'Content bytes remain frozen at558b83. 300c622 adds one erased type assertion;0a0beb9 changes tests/benchmark fields. 094998b bounds LOCAL foundation library and reuses catalog validation; grading/view/start default paths are unchanged. Full44 SQL is at0a, with three library checks/six grading regression cases and repaired navigation at094. Source distinctions are explicit.','policySha256':sha('AGENTS.md',True),'sourceSha256':h4['sourceSha256'],'HSK4':{'completedBatches':9,'newBatchRange':[2,9],'newBatches':8,'newUnits':32,'newIntroductionLessons':32,'newIntroductionExercises':256,'newReviewActivities':8,'newReviewExercises':64,'newTotalExercises':320,'vocabularyTaught':216,'denominator':1000,'remainingVocabulary':784,'currentIntroductionLessons':36,'currentActivities':44,'currentExercises':352,'currentImmutableVersions':62,'newHistoricalRefinements':18,'summary':h4['summary'],'unitReviewCoverage':'Four of36 introduction units; other units not exhaustively reviewed','sampledDiagnosticCharacters':h4['reviews']['sampledDiagnosticCharacters'],'legacyShallowGrammarOrderingNotAcceptedAsMeaningfulPractice':h4['legacyShallowGrammarOrdering']},'expansion':{'versions':289,'currentActivities':234,'historicalVersions':55,'currentExercises':1872,'serverVersionsIncludingSixBase':295},'tests':tests,'batchSQL':batchtests,'reviewAndRepairSQL':repairs,'acceptedSQLExecutions':sum(x['pass'] for x in batchtests+repairs)+48+8+8+1+3+6,'sqlCountingRule':'Execution totals include repeated shared/milestone cases;44unique current HSK4 activities were exercised in the clean48-case run.','codeChecks':checks,'earlierTestHarnessChecks':proofchecks,'libraryBounds':read('.local-postgres/hsk24/hsk4-production-library-bounds.json'),'negativeAdvanceGuards':{'path':'.local-postgres/hsk24/hsk4-advance-negative.json','sha256':sha('.local-postgres/hsk24/hsk4-advance-negative.json'),'logSha256':sha('.local-postgres/hsk24/hsk4-advance-negative.log'),'cases':6,'pass':6,'fail':0,'result':negative,'sourceNote':'Executed before the ea89306 checkpoint; later formatting preserves the checked guard semantics. Not relabelled as an exact0a0beb9 rerun.'},'intermediateFailures':[{'kind':'SQL harness historical-origin lookup','evidence':initial,'explanation':'All44 lesson activities and three shared cases passed; shared unit-review test searched only currentDrafts and missed retainedL409v1 afterv2. Harness now resolves the registered historical package; complete48-case rerun passes.','fixedAt':'0a0beb9e1da8ad93f9520282e1494408eba2b812'},{'kind':'Typecheck/build helper literal widening','result':read('.local-postgres/hsk24/hsk4-production-initial-code-checks.json'),'typecheckLogSha256':sha('.local-postgres/hsk24/hsk4-production-initial-typecheck.log'),'buildLogSha256':sha('.local-postgres/hsk24/hsk4-production-initial-build.log'),'fixedAt':'300c622034b859680b7c7abc5d1199a1be2177c0','runtimeChange':False}],'authoringPreflightNotes':'Early descriptors failed closed for opt-in/ASCII/timestamp/syllable/slug/glyph requirements. One initial import registered four new immutable packages before rejecting invalid new catalog slugs; those packages were retained and new catalog aliases corrected. Earlier overwritten import/preflight logs are evidenced by the execution transcript, not falsely claimed as retained raw files.','preservation':{'database':before['database'],'databaseSwitched':False,'newSandboxCreated':False,'baselinePackagesUnchanged':231,'baselineSourceReferencesUnchanged':1418,'beforeCounts':counts(before),'afterCounts':counts(after),'allInitialRecordedRowsUnchanged':True,'beforePath':'.local-postgres/hsk24/hsk4-production-before.json','beforeSha256':sha('.local-postgres/hsk24/hsk4-production-before.json'),'afterPath':'.local-postgres/hsk24/hsk4-production-after.json','afterSha256':sha('.local-postgres/hsk24/hsk4-production-after.json'),'imports':imports,'limits':'Recorded package-hash,attempt,session,card rows preserved; not a full backup/restore or comparison of every private table. Synthetic fresh test owners add rows. No global history/card migration between versions/databases.'},'clientIsolation':{'production':prod,'development':dev},'trackedEvidenceHashes':[{'path':p,'sha256':sha(p,True),'normalization':'UTF8 LF matching Git'} for p in tracked],'preliminaryContentQA':{'verdict':'PASS','reviewer':'/root/hsk4_content_review','reviewedSourceCommit':'300c622034b859680b7c7abc5d1199a1be2177c0','scope':'Every new batch plus review/repair bytes, source readings, naturalness and bounded answer agreement; all289semanticpackagehashes and32glyph tags independently checked. AIpreliminaryQA only.','qualifiedHumanApproval':False},'independentSourceAudit':{'reviewer':'/root/hsk4_final_technical_review','source':'300c622034b859680b7c7abc5d1199a1be2177c0','result':'NO_BLOCKING_SOURCE_DEFECT_FOUND','scope':'Actual289hashes,baselinebindings/bytes/catalog,366newPDFreferences,selectedDBread-only preservation,rawunit120/H2+H3regression/codechecks. Finalremainingevidence not yet independently accepted.'},'independentFinalTechnicalReview':'PENDING_FINAL_EVIDENCE_REVIEW','humanReview':None,'rightsApproval':False,'publicationStatus':'BLOCKED','learnerMastered':None,'onlinePrivatePreviewChanged':False,'push':False,'merge':False,'deployment':False,'cloudSupabaseWrites':False,'paidServices':False,'previewURL':'http://127.0.0.1:3037/learn/courses/HSK4','proofFinalizerSha256':sha('scripts/finalize-hsk4-production.py',True),'nextCheckpoint':'docs/hsk24/hsk4-production-next-checkpoint.json'}
assert report['acceptedSQLExecutions']==183
initialnav='.local-postgres/hsk24/hsk4-production-initial-navigation-browser.json'
ns=read(initialnav)['stats'];assert ns['unexpected']>0
report['intermediateFailures'].append({'kind':'Initial course/unit navigation browser attempt','path':initialnav,'sha256':sha(initialnav),'stats':ns,'traceArchive':'.local-postgres/hsk24/hsk4-navigation-initial-evidence.zip','traceArchiveSha256':sha('.local-postgres/hsk24/hsk4-navigation-initial-evidence.zip'),'explanation':'Confirmed local library scaling defect: all238currentpackages were fetched and the295-versioncatalog was revalidated perpackage insideoneownertransaction. Traces503 andadvisory-locktimeouts; repairedbyboundingFoundationLibrarytofourbasepackages andrequest-localvalidationreuse. Rerunusesexactoriginaltestservercommand;no database timeout/Auth/RLS gate weakened.'})
write('docs/hsk24/hsk4-production-verification.json',report)
c=read('docs/hsk24/checkpoint.json')
c.update(completedBatch='HSK4-batch9',verification='docs/hsk24/hsk4-production-verification.json',nextCheckpoint=report['nextCheckpoint'],currentRunBaseCommit=baseline,currentExpandedLessonCount=234,currentExpandedExerciseCount=1872,currentLessonCount=234,currentExerciseCount=1872,historicalVersionCount=55,historicalExpansionVersionCount=55,currentIntroductionLessonCount=154,unitReviewCount=42,diagnosticCount=31,HSK4LessonCount=36,HSK4ExerciseCount=288,HSK4ReviewActivityCount=8,HSK4ReviewExerciseCount=64,newHSK4BatchesThisContinuation=8,newHSK3BatchesThisContinuation=0,newHSK2GapLessonsThisContinuation=0,newBatchesThisContinuation=8,nextBatchToAuthor='HSK4-batch10',nextBatchFile=checkpoint['authoringFileToCreate'],coverageSha256=sha('docs/hsk24/coverage.json',True),latestMilestoneFinalizer='scripts/finalize-hsk4-production.py (specific assertions for this milestone)')
c['lessons']=[p['lesson']['versionId'] for p in selected];c['completedBatches']=[f'HSK2-batch{i}' for i in range(1,10)]+[f'HSK3-batch{i}' for i in range(1,22)]+[f'HSK4-batch{i}' for i in range(1,10)]
c['coverageVocabulary']={'HSK1':8,'HSK2':200,'HSK3':500,'HSK4':216};c['remainingNewVocabulary']={'HSK1':292,'HSK2':0,'HSK3':0,'HSK4':784};c['pendingVocabularyOrdinals']={'HSK1':[v['ordinal'] for v in coverage['vocabulary'] if v['introductionLevel']==1 and v['status']!='CONTENT_DRAFT'],'HSK2':[],'HSK3':[],'HSK4':remaining}
c['currentMilestones']={'HSK2Curriculum':'PARTIAL','HSK3Vocabulary':'DRAFT_INSTRUCTION_COMPLETE','HSK3Curriculum':'PARTIAL','HSK4Vocabulary':'216_OF_1000_DRAFT','HSK4Curriculum':'PARTIAL','HumanReviewPublication':'BLOCKED'}
c['resumeCommand']='Continue exactHSK4 batch10 ordinals in hsk4-production-next-checkpoint.json, preserving selectedbf294b6506c1 database and immutable versions.'
c['nextBatchesInOrder']=['HSK4-batch10 L437-L440 exact24selectedordinals','Resolve final independent technical gate; then continue sequential verified HSK4 batches','Reconcile ID namespace beforeL481 collision; do not restartHSK1-3']
c['pending']=['HSK4 still784vocabulary entries and material grammar/character/topic/task gaps','HSK1 has292missingvocabulary entries;HSK2/HSK3curricula remainpartial','BaselineL403/L404twochunkordering does not establish meaningfulgrammarpractice','Competent human language/answer/rights review and publication remainblocked','Listening,speaking,handwriting and valid free-writing evaluation unsupported','Final independent technical evidence gate pending actual evidence review','No fullbackup/restore or global cross-version card/history migration proof']
c['knownContentIssues']=['All senses/examples/keys provisional;AIchecks are not competent human approval','55historical expansion versions retained outside currentactivity counts','Source mapping is not full instruction;partial physical rows remainunaccepted','No automatic prerequisite mastery','Same selecteddatabase preserved; new synthetic test owners add rows']
write('docs/hsk24/checkpoint.json',c)
c=read('docs/hsk24/hsk4-production-checkpoint.json');c.update(nextCheckpoint=report['nextCheckpoint'],exactNextSelectedOrdinals=checkpoint['exactSelectedOrdinals'],verification='docs/hsk24/hsk4-production-verification.json',sourceCommit=source,independentFinalTechnicalReview=report['independentFinalTechnicalReview']);write('docs/hsk24/hsk4-production-checkpoint.json',c)
write('docs/hsk24/hsk34-next-checkpoint.json',{'status':'HISTORICAL_CHECKPOINT_SUPERSEDED','historicalSnapshotCommit':baseline,'currentCheckpoint':report['nextCheckpoint'],'currentVerification':'docs/hsk24/hsk4-production-verification.json'})
p=root/'docs/hsk24/hsk34-delivery.md';s=p.read_text('utf8');notice='> Historical milestone at4fab1cc. Current HSK4 production: [delivery](hsk4-production-delivery.md), [verification](hsk4-production-verification.json), [next checkpoint](hsk4-production-next-checkpoint.json).\n\n';p.write_text(notice+s if not s.startswith('> Historical milestone at4fab1cc') else s,encoding='utf8')
p=root/'docs/hsk24/README.md';s=p.read_text('utf8');line='Current production evidence: [HSK4 batches2-9](hsk4-production-delivery.md), [verification](hsk4-production-verification.json), [five-dimensional matrix](hsk4-coverage.json), [instruction links](hsk4-instruction-evidence.json), [next exact checkpoint](hsk4-production-next-checkpoint.json). Earlier reports below are historical.\n\n';p.write_text(line+s if not s.startswith('Current production evidence:') else s,encoding='utf8')
g=h4['summary'];table='\n'.join(f"| {name} | {x['pass']} | {x['fail']} | {x['skipped']} |" for name,x in tests.items());perf=read('docs/hsk24/hsk4-production-performance.json')
md=f'''# HSK4 production continuation — batches2–9

**HSK4_PARTIAL / HSK24_EPIC_PARTIAL**. HSK4 has216/1000 additional vocabulary entries with original draft instruction;784remain. All content remainsDRAFT/DRAFT_UNREVIEWED, publicationBLOCKED, no competent human review or mastery approval.

Branch`feat/hsk24-curriculum`; baseline`{baseline}`. Evidence source`{source}`; app/content frozen at`{runtime}`. Content bytes remain frozen at558b83. Later commits fix a proof type annotation, tests and a confirmed LOCAL foundation-library scaling defect; grading, immutable content and published/custom access behavior remain unchanged. The current final documentation HEAD is available through`git log -1 --format=%H`; it is not retroactively assigned to earlier runs.

## Actual new learning content

Eight new batches2–9 add32units/introductions(L405–436),192vocabulary ordinals and256exercises. They begin with exactly the saved batch2ordinal order. Eight periodic activities(L481–488) add64exercises:four unit reviews andfour sampled-character diagnostics, atbatches4/6/8/9. Total new content:40activities/320exercises.

Current HSK4:36introduction units/lessons,288introexercises,8review/diagnostic activities/64exercises:44activities/352exercises. Each new lesson includes original Vietnamese sense/usage notes, Chinese examples and Pinyin, an original written scene, bounded contextual responses, glyph practice, reading comprehension and constituent ordering. Durations15–20minutes are authoring estimates, not learner timing measurements. Synonyms/polyphones and form-specific tasks are explicitly bounded; free paraphrases and open writing are not objectively graded.

## Five dimensions

| Dimension | Current evidence | Limit |
| --- | --- | --- |
| Vocabulary |216/1000draft-taught ordinals|784missing; source entry/reading verification does not attest Vietnamese senses |
| Grammar |{g['grammarRowsMappedCandidates']}/95physical rows mapped;{g['grammarRowsWithExplicitPartialPractice']}have explicit partial teaching/practice|No row fully accepted; baselineL403/L404two-chunk ordering excluded from meaningful grammar-practice counts |
| Recognition |{g['recognitionCharacterRefs']}/441referenced;{g['recognitionCharactersExplicitlyPracticed']}distinct glyphs practiced in{g['recognitionPracticeExercises']}assisted items|32newintroitems+24diagnosticitems+1reusedunitreviewitem;57items are not57uniqueglyphs |
| Topics |{g['topicLeavesMapped']}/77leafs linked to written scenes|Related subclauses/modalities remainpartial |
| Communication |{g['taskHeadsReferenced']}/30heads referenced;139physical bullets enumerated|Written reception/bounded response only;parent-head linkage does not accept the bullet or spoken task |
| Writing glyphs |150listed|Handwriting unsupported |

Four of36introduction units have separate unit reviews. Diagnostics sample24distinct official glyphs with familiar meaning/Pinyin cues; they are not official exam papers or comprehensive recognition tests. Identified,mapped,taught,practiced,technically validated,human reviewed,published andlearner mastered remain distinct. Explicit immutable block/exercise/hash links are in[hsk4-instruction-evidence.json](hsk4-instruction-evidence.json).

Listening,reviewed native audio,speaking assessment,handwriting andvalid free-writing evaluation remain unsupported. Optional synthetic browserTTS, if used, is not listening/proficiency evidence. HSK1remains8/300draft words;HSK2remains200/200vocabulary butgrammar/subrequirements partial;HSK3remains500/500vocabulary with55/96grammar mappings(51partial practice),283/284recognition references(60practiced),41/54topics and20/22taskheads. No prerequisite mastery was awarded.

## Source and substantive corrections

The pinned406-page November2025`hsk-exam-2025-11`PDF SHA256 is`{h4['sourceSha256']}`. All1784bounded references and2000vocabulary locators pass the source audit. The independent source reviewer checked all366newreferences directlyagainst the actual PDF. No 2021/older syllabus or textbook lesson was substituted; the private PDF is not redistributed with the original lessons.

Readings include等2(děng,enumeration),乘1(chéng,transport),待dāi,戴dài,大夫dàifu,护士hùshi,胳膊gēbo and差点儿chàdiǎnr. Source numeric disambiguators are removed from learner Hanzi. Corrections use18higher immutable versions across17lessons: clearer form constraints, meaningful ordering, explicit base-price comparison, a natural Mandarin predicate, better task alignment andfive recognition-skill tags. Original versions and pinned attempts remain intact. Mandarin/Vietnamese checks are preliminaryAIQA, never competent human approval.

## Actual accepted checks

| Group | PASS | FAIL | SKIPPED |
| --- | ---: | ---: | ---: |
{table}

Eight per-batch SQL groups add70PASS; periodic-review/refinement groups add39PASS. With the clean milestone48+8+8+1groups plus3library-bound/security checks and6post-library grading regressions, this is183acceptedSQLexecutions, including repeated shared cases. All44currentHSK4activities are exercised in the clean48-case run. Unit total120;browser total16,desktop and360pxWindowsChromiumemulation, not physicalAndroidUAT. Choice,Pinyin,bounded Chinese,recognition,keyboard ordering,resume/reload,completion,FSRS,Progress,Today,unit links,invalid submissions andowner isolation are covered. Typecheck,lint andproductionbuild exit0; six local-pointer guard/rollback assertions pass separately.

Intermediate evidence is retained separately: the initial fullSQLgroup has47PASS/1FAIL/0SKIP because the harness searched only current versions and missed a deliberately retained review origin. The fixed harness resolves the exact historical version; the complete48-case rerun passes. Initial typecheck exited2/build1on a proof-helper literal type;`as const` fixes it without runtime/content mutation. The first additional navigation run also failed with503responses and advisory-lock timeouts; its raw report/traces are retained separately. The confirmed cause was the local foundation library looping through all238currentpackages and revalidating the295-versioncatalog for each while holding the owner transaction. The LOCAL default library now returns onlyfourbasepackages and reuses validation within the request. Rerunuses the originaltestservercommand, without increasing timeouts or weakeningAuth/RLS;published/customaccess is unchanged. Early descriptor/import failures are documented in the execution transcript; overwritten early logs are not falsely described as retained artifacts.

## Selected database and history

All work uses the same selected local database`{before['database']}` on127.0.0.1:5447. No new sandbox, reset, database switch or cross-identity history merge occurred. Before the run it contained237packages,110attempts,218sessions and67cards. After tests it contains{counts(after)}; all recorded original row hashes remain unchanged. Additive imports compare full existing package-hash/attempt/session/card rows before/after, not just counts. New test owners deliberately add synthetic rows. This proves the recorded table families, not a full backup/restore or comparison of every private table.

There are295server package versions:289expansion versions,234current and55historical,plus6baseversions. All231baseline expansion package bindings/Git-normalized bytes and1418baseline source references are unchanged. An explicit local-only import option advances a lesson pointer only to a higher HSK4DRAFT/BLOCKED version with identical concept bytes; metadata conflicts roll the transaction back. Old associations remain pinned. Review aliases reuse their exact source-version card identity; global card deduplication/migration across all versions is not claimed.

## Loading, confidentiality and scope

Production scans{prod['files']}artifacts/{prod['bytes']}bytes;development scans{dev['files']}artifacts/{dev['bytes']}bytes. Both check2312private-key identifiers with0hits, alongside per-package public-projection tests. Artifact totals include maps/all scanned files, not initial-page payload, and are not a formal leak proof.

The server corpus is{perf['corpusServerBytes']}bytes;maxpublicpackage{perf['publicPackageBytes']['max']}bytes. Local catalogp50about{perf['catalogLoadMs']['p50']:.0f}ms;three level2/3/4views issue9SQLstatements each. Measurements are local under concurrent tests, not a cloudSLA. Native read-only checks confirm the repaired foundation library makes fourpackage-lookups, returns41,151publicbytes and permits concurrent same-owner course metadata; tampered hashes/revoked permissions still fail. Course pages read metadata and individual version-pinned public lessons;the entire HSK4private corpus is not sent to the first page. Full corpus validation still has server cost;the existing40-card request-local index is measured, while the newly fixed foundation-library request reuse is a separate bounded optimization.

No push,merge,deploy,cloudSupabasewrite,productionallowlist change,paid dependency,Auth/RLS weakening,private-key client exposure orcanonical task-status update occurred. The onlinePrivateLearningPreview is unchanged.

## Review boundary and exact continuation

The separate content reviewer returned preliminaryQA PASS for every new batch/repair andactualbytes. The separate final reviewer found no blocking source defect andverified preserved rows. Its first continuation hit the included-quota limit and later resumed without paid fallback. **Final independent technical gate is pending** until the remaining actual evidence is reviewed, not self-approved. Rights,competent language,publication andmastery approvals remain absent.

Next:HSK4batch10,L437–440,descriptor`content/hsk24/batch40.authoring.json`. [Exact checkpoint](hsk4-production-next-checkpoint.json) records the next24selected ordinals andall784missing ordinals. Reconcile IDallocation beforeL481,already occupied byreviews;the current three-digit convention cannot hold all1000entries at six perintro. NextL437–440are valid. Do not restart HSK1–3 or silently replace the selected database.

Preview:[localHSK4](http://127.0.0.1:3037/learn/courses/HSK4). Reopen with`CSH_HSK3_CHECK_BUILD=1`,`CSH_HSK24_PREVIEW_PORT=3037`,`node scripts/hsk24-preview.mjs`; it uses a local development identity, not authenticated human-owner proof. [Machine verification](hsk4-production-verification.json) pins actual raw-evidence hashes. Documentation/receipt commits after the frozen source do not relabel earlier checks.
'''
md=md.replace('The fixed harness resolves the exact historical version; the complete48-case rerun passes.', 'The fixed harness resolves the exact historical version; the complete48-case rerun passes. That full run used0a0beb9. The later library-only change at094998b is covered by three dedicated bounds/security cases, six focused grading cases and four real navigation cases; the independent reviewer found no reason to repeat all44 unchanged lesson paths a third time. Sources are not relabelled.')
def readable_markdown(value):
 value=re.sub(r'(558b83|0a0beb9|094998b)(?![0-9a-f])',r'`\1`',value)
 replacements={
  'currentpackages':'current packages','publicbytes':'public bytes','serverpackage':'server package',
  'introexercises':'intro exercises','newintroitems':'new intro items','diagnosticitems':'diagnostic items',
  'reusedunitreviewitem':'reused unit review item','uniqueglyphs':'unique glyphs','taskheads':'task heads',
  'remainpartial':'remain partial','andle arner':'and learner','andlearner':'and learner','andvalid':'and valid',
  'butgrammar':'but grammar','directlyagainst':'directly against','andfive':'and five','batches':'batches',
  'allcurrent':'all current','sampledcharacters':'sampled characters','publicpackage':'public package',
  'maxpublicpackage':'max public package','fourbasepackages':'four base packages','fourpackage-lookups':'four package lookups',
  'versioncatalog':'version catalog','originaltestservercommand':'original test server command','Rerunuses':'Rerun uses',
  'published/customaccess':'published/custom access','supabasewrite':'supabase write','instructionlinks':'instruction links',
  'invariantsremain':'invariants remain','humanapproval':'human approval','languageapproval':'language approval',
  'additionalvocabulary':'additional vocabulary','of36':'of 36','atbatches':'at batches','andactualbytes':'and actual bytes',
  'andverified':'and verified','newreferences':'new references','taskhead':'task head','recordedfamilies':'recorded families',
  'packagebindings':'package bindings','sourceversion':'source version','introitems':'intro items',
  'baseversions':'base versions','privatecorpus':'private corpus','IDallocation':'ID allocation',
  'alreadyoccupied':'already occupied','byreviews':'by reviews','andall':'and all','entriesat':'entries at',
  'perintro':'per intro','for_every':'for every','read-onlychecks':'read-only checks','leafs':'leaves',
  'andfour':'and four','andthree':'and three','andfive':'and five','andsix':'and six',
  'SQLexecutions':'SQL executions','SQLgroup':'SQL group','SQLstatements':'SQL statements',
  'Chromiumemulation':'Chromium emulation','onlyfour':'only four','andowner':'and owner',
  'andproductionbuild':'and production build','andmastery':'and mastery','on127':'on 127',
 }
 parts=re.split(r'(`[^`]*`|\[[^\]]*\]\([^)]*\)|HSK(?:24|[1-4])(?:_[A-Z_]+)?|[FL]\d{2,3}|p(?:50|90))',value)
 result=''
 for index,part in enumerate(parts):
  if index%2:
   if result and (result[-1].isalnum() or result[-1] in ';,:='):result+=' '
   result+=part
   if index+1<len(parts) and parts[index+1] and parts[index+1][0].isalnum():result+=' '
  else:
   for old,new in sorted(replacements.items(),key=lambda item:-len(item[0])):part=part.replace(old,new)
   part=re.sub(r'(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])',' ',part)
   part=re.sub(r'(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Za-z])',' ',part)
   part=re.sub(r'(?<!\d),(?=\S)|,(?!\d)(?=\S)|;(?=\S)',lambda m:m[0]+' ',part)
   part=re.sub(r':(?=[A-Za-z])|(?<!\d):(?=\d)',': ',part)
   part=re.sub(r'(?<=[A-Za-z])(?=\()',' ',part)
   part=re.sub(r'([\u4e00-\u9fff])(?=[A-Za-z])',r'\1 ',part)
   result+=part
 return result
(root/'docs/hsk24/hsk4-production-delivery.md').write_text(readable_markdown(md),encoding='utf8')
print('PASS: delivery derived from actual accepted logs, unchanged baseline rows and exact784remaining ordinals; final independent gate remains pending.')

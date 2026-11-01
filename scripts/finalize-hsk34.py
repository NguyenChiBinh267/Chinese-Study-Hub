"""Finalize only from actual accepted logs and current immutable packages."""
import hashlib,json,re,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((root/p).read_text('utf8'))
baseline='55870a2962390df07c68cd3476f38c87fc80f0dd'
git=lambda *args:subprocess.check_output(['git',*args],cwd=root)
def digest(p,tracked=False):
 b=(root/p).read_bytes();return hashlib.sha256(b.replace(b'\r\n',b'\n') if tracked else b).hexdigest()
def node_log(path,expected):
 t=(root/path).read_text('utf8');n=lambda k:int(re.search(r'\b'+k+r' (\d+)\b',t)[1]);s={k:n(k) for k in ['tests','pass','fail','skipped']};assert s=={'tests':expected,'pass':expected,'fail':0,'skipped':0},(path,s)
 return {'path':path,'sha256':digest(path),**s}
def browser(path,expected):
 d=read(path);s=d['stats'];assert s['expected']==expected and s['unexpected']==0 and s['flaky']==0 and s['skipped']==0,(path,s)
 return {'path':path,'sha256':digest(path),'pass':s['expected'],'fail':s['unexpected'],'flaky':s['flaky'],'skipped':s['skipped']}
h3=read('docs/hsk24/hsk3-coverage.json');h4=read('docs/hsk24/hsk4-coverage.json');cat=read('content/hsk24/catalog.json');manifest=read('content/hsk24/manifest.json');registry=read('content/hsk24/reviews.json');current={l['currentVersion'] for l in cat['lessons']}
packages=[read('content/hsk24/'+m['file']) for m in manifest['packages']];selected=[p for p in packages if p['lesson']['versionId'] in current]
assert h3['vocabulary']['ordinals']==list(range(501,1001)) and len(h3['lessonVersions'])==84 and len(h3['reviews']['activities'])==15
assert h4['vocabulary']['taught']==24 and len(h4['lessonVersions'])==4 and h4['exercises']==32
assert len(selected)==194 and sum(len(p['exercises']) for p in selected)==1552
old_manifest=json.loads(git('show',baseline+':content/hsk24/manifest.json'));old_evidence=json.loads(git('show',baseline+':content/hsk24/evidence.json'))
for m in old_manifest['packages']:
 assert m in manifest['packages'];assert git('show',baseline+':content/hsk24/'+m['file']).replace(b'\r\n',b'\n')==(root/'content/hsk24'/m['file']).read_bytes().replace(b'\r\n',b'\n'),m['file']
evidence=read('content/hsk24/evidence.json')
for ref in old_evidence['references']:assert ref in evidence['references'],ref['id']
protected=['AGENTS.md','docs/master-plan','docs/implementation','docs/engineering-loop','supabase/migrations','content/releases/trusted.json','src/modules/auth','src/app/api/v1','package.json','package-lock.json']
assert not git('diff','--name-only',baseline,'--',*protected).strip(),'PROTECTED_SCOPE_CHANGED'
tests={'unit':node_log('.local-postgres/hsk24/hsk34-final-unit.log',119),'HSK3NewAndRefinedActivitiesSQL':node_log('.local-postgres/hsk24/hsk3-final-sql.log',87),'HSK4SQL':node_log('.local-postgres/hsk24/hsk4-final-sql.log',8),'HSK3PostAdapterSQL':node_log('.local-postgres/hsk24/hsk34-post-adapter-hsk3-sql.log',9),'HSK2RegressionSQL':node_log('.local-postgres/hsk24/hsk34-hsk2-regression-sql.log',8),'all194ManifestResumeSQL':node_log('.local-postgres/hsk24/hsk34-manifest-sql.log',1),'HSK3BrowserDesktopAnd360':browser('.local-postgres/hsk24/hsk3-final-browser.json',8),'HSK4BrowserDesktopAnd360':browser('.local-postgres/hsk24/hsk4-final-browser.json',4),'HSK4TodayDesktopAnd360':browser('.local-postgres/hsk24/hsk4-today-browser.json',2)}
checks=read('.local-postgres/hsk24/hsk34-code-checks.json');assert all(checks[k]==0 for k in ['typecheckExit','lintExit','buildExit'])
prod=read('.local-postgres/hsk24/hsk34-production-client-isolation.json');dev=read('.local-postgres/hsk24/hsk34-dev-client-isolation.json');assert prod['passed'] and dev['passed'] and prod['markerHits']==dev['markerHits']==0
before=read('.local-postgres/hsk24/history-before.json');after=read('.local-postgres/hsk24/history-after.json')
for d in before['databases']:assert next(a['tables'] for a in after['databases'] if a['database']==d['database'])==d['tables'],d['database']
imports=[]
for p in ['hsk3-batch5-6-import.log','hsk3-batch7-import.log','hsk3-batch13-15-import.log','hsk3-batch16-17-import.log','hsk3-batch18-import.log','hsk3-batch19-import.log','hsk3-batch20-21-import.log','hsk4-final-import.log']:
 path='.local-postgres/hsk24/'+p;t=(root/path).read_text('utf8');obj=json.loads(next(l for l in reversed(t.splitlines()) if l.startswith('{')));imports.append({'path':path,'sha256':digest(path),'preservation':obj})
tracked=['docs/hsk24/coverage.json','docs/hsk24/hsk3-coverage.json','docs/hsk24/hsk4-coverage.json','docs/hsk24/hsk3-instruction-evidence.json','docs/hsk24/hsk34-performance.json']
report={'schemaVersion':1,'status':'HSK3_VOCABULARY_COMPLETE / HSK3_CURRICULUM_PARTIAL / HSK24_EPIC_PARTIAL','baseline':baseline,'sourceCandidateCommit':git('rev-parse','HEAD').decode().strip(),'HSK3FullRuntimeSourceCommit':'d284063a0b01b7c105b1f2366499bcff03dc398c','postAdapterRegression':'The only later domain change adds bounded HSK4 page ranges; unchanged HSK1-3 paths covered by all-package unit validation and nine current SQL cases.','branch':git('branch','--show-current').decode().strip(),'sourceSha256':h3['sourceSha256'],'HSK3':{'completedBatches':21,'newBatchesThisRun':17,'newIntroductionLessons':68,'newIntroductionExercises':544,'currentIntroductionLessons':84,'currentIntroductionExercises':672,'vocabularyTaught':500,'vocabularyDenominator':500,'summary':h3['summary'],'reviewActivities':15,'reviewExercises':120},'HSK4':{'completedBatches':1,'lessons':4,'exercises':32,'vocabularyTaught':24,'vocabularyDenominator':1000,'summary':h4['summary']},'expansion':{'currentActivities':len(selected),'currentExercises':sum(len(p['exercises']) for p in selected),'manifestVersions':len(packages),'historicalVersions':len(packages)-len(selected),'serverVersionsIncludingSixBase':len(packages)+6},'tests':tests,'codeChecks':checks,'clientIsolation':{'production':prod,'development':dev},'preservation':{'baselinePackagesUnchanged':len(old_manifest['packages']),'baselineSourceReferencesUnchanged':len(old_evidence['references']),'retainedDatabaseDigestsUnchanged':before['databases'],'beforePath':'.local-postgres/hsk24/history-before.json','beforeSha256':digest('.local-postgres/hsk24/history-before.json'),'afterPath':'.local-postgres/hsk24/history-after.json','afterSha256':digest('.local-postgres/hsk24/history-after.json'),'additiveImports':imports,'limit':'Semantic full-row digests/package hashes and retained databases; not a backup/restore proof.'},'trackedReportHashes':[{'path':p,'sha256':digest(p,True),'normalization':'UTF8 LF matching Git'} for p in tracked],'sourceNegative':read('.local-postgres/hsk24/hsk34-source-negative.json'),'failedIntermediateRuns':[{'path':'.local-postgres/hsk24/hsk3-batch5-12-sql.log','sha256':digest('.local-postgres/hsk24/hsk3-batch5-12-sql.log'),'pass':35,'fail':1,'skipped':0,'reason':'Source advanced to56 HSK3 activities while installed snapshot had48. All32 lesson cases passed; aggregate catalog equality correctly failed. Later quiescent87-case selection accepted without weakening count assertion.'}],'humanReview':None,'publicationStatus':'BLOCKED','learnerMastered':None,'onlinePrivatePreviewChanged':False,'push':False,'merge':False,'deployment':False,'liveSupabaseWrites':False,'paidServices':False,'previewURL':'http://127.0.0.1:3037/learn/courses/HSK4','independentTechnicalReview':'EXACT_SOURCE_SHA_GATE_PENDING','qualifiedLanguageReview':False}
(root/'docs/hsk24/hsk34-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
groups=[{'theme':'Work communication and commitments','ordinals':[1035,1036,1037,1081,1111,1015]},{'theme':'Polite communication and convenience','ordinals':[1019,1118,1115,1031,1044,1112]},{'theme':'Visiting a workplace','ordinals':[1062,1072,1088,1050,1089,1069]},{'theme':'Study documents and revision','ordinals':[1119,1120,1113,1098,1060,1087]}]
remaining=h4['vocabulary']['remainingOrdinals'];assert all(n in remaining for g in groups for n in g['ordinals'])
checkpoint={'status':report['status'],'nextHSK4Batch':2,'authoringFileToCreate':'content/hsk24/batch32.authoring.json','targetLessonIds':['L405','L406','L407','L408'],'groups':groups,'exactSelectedOrdinals':[n for g in groups for n in g['ordinals']],'allRemainingHSK4Ordinals':remaining,'remainingHSK3VocabularyOrdinals':[],'remainingHSK3GrammarRowIds':[g['id'] for g in h3['grammar'] if not g.get('instructionEvidence')],'remainingHSK3UnmappedTopicIds':[t['id'] for t in h3['topics'] if not t['sourceReferenceIds']],'HSK3RecognitionNotMapped':[{'ordinal':c['ordinal'],'character':c['character']} for c in h3['characters'] if not c['mapped']],'HSK3RecognitionNotExplicitlyPracticed':[c['ordinal'] for c in h3['characters'] if not c.get('practiceEvidence')],'HSK1VocabularyStillMissing':292,'HSK2GrammarRowsWithoutExplicitEvidence':read('docs/hsk24/hsk2-reconciliation.json')['remainingGrammarRows'],'sourceSha256':h3['sourceSha256'],'publicationStatus':'BLOCKED','humanReview':None,'learnerMastered':None,'rule':'Check actual existing scene/grammar evidence before duplicate authoring. Open rows and all modality/subrequirement gaps remain partial even where referenced. Preserve immutable versions, history, private keys and secure prerequisites.'}
(root/'docs/hsk24/hsk34-next-checkpoint.json').write_text(json.dumps(checkpoint,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
p=root/'docs/hsk24/hsk3-continuation-checkpoint.json';c=read('docs/hsk24/hsk3-continuation-checkpoint.json');c.update(status=report['status'],completedHSK3Batches=list(range(1,22)),authoredHSK3Batches=list(range(1,22)),vocabularyTaught=500,lessons=84,exercises=672,reviews=15,reviewExercises=120,nextBatch='HSK4-batch2',nextLessonIds=checkpoint['targetLessonIds'],remainingOrdinals=[],HSK4Started=True,HSK4Vocabulary=24,HSK4Lessons=4,HSK4Exercises=32,runtimeLimit='Accepted groups in docs/hsk24/hsk34-verification.json; intermediate failures retained separately.',independentReview='EXACT_SOURCE_SHA_GATE_PENDING',nextCheckpoint='docs/hsk24/hsk34-next-checkpoint.json');p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
p=root/'docs/hsk24/checkpoint.json';c=read('docs/hsk24/checkpoint.json');c.update(completedBatch='HSK3-batch21-and-HSK4-batch1',verification='docs/hsk24/hsk34-verification.json',nextCheckpoint='docs/hsk24/hsk34-next-checkpoint.json',hsk3Status='HSK3_VOCABULARY_COMPLETE / HSK3_CURRICULUM_PARTIAL',HSK3LessonCount=84,HSK3ExerciseCount=672,HSK3ReviewActivityCount=15,HSK3ReviewExerciseCount=120,HSK4LessonCount=4,HSK4ExerciseCount=32,currentExpandedLessonCount=194,currentExpandedExerciseCount=1552,historicalExpansionVersionCount=len(packages)-len(selected),newBatchesThisContinuation=17,nextBatchToAuthor='HSK4-batch2',nextBatchFile='content/hsk24/batch32.authoring.json',resumeCommand='Continue exactHSK4 batch2 selected ordinals in hsk34-next-checkpoint.json; reconcile remaining HSK3/HSK2 grammar/character/topic/task subrequirements without duplicate lessons.',coverageSha256=digest('docs/hsk24/coverage.json',True),currentRunBaseCommit=baseline);c['coverageVocabulary']={'HSK1':8,'HSK2':200,'HSK3':500,'HSK4':24};c['remainingNewVocabulary']={'HSK1':292,'HSK2':0,'HSK3':0,'HSK4':976};c['pendingVocabularyOrdinals']={'HSK3':[],'HSK4':remaining};p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
# Keep the former HSK2-only fields from silently looking like whole-epic totals.
c=read('docs/hsk24/checkpoint.json')
c.update(lessons=[p['lesson']['versionId'] for p in selected],currentLessonCount=194,currentExerciseCount=1552,historicalVersionCount=37,currentIntroductionLessonCount=122,unitReviewCount=38,diagnosticCount=27,characterBridgeCount=1,currentHSK2GapActivities=6,newHSK2GapLessonsThisContinuation=0,newHSK3BatchesThisContinuation=17,newHSK4BatchesThisContinuation=1,newBatchesThisContinuation=18)
c['completedBatches']=[f'HSK2-batch{i}' for i in range(1,10)]+[f'HSK3-batch{i}' for i in range(1,22)]+['HSK4-batch1']
c['historicalMilestonesAtPreviousCheckpoint']=c.pop('milestones',c.get('historicalMilestonesAtPreviousCheckpoint',{}))
c['currentMilestones']={'HSK2Curriculum':'PARTIAL','HSK3Vocabulary':'DRAFT_INSTRUCTION_COMPLETE','HSK3Curriculum':'PARTIAL','HSK4Vocabulary':'24_OF_1000_DRAFT','HSK4Curriculum':'PARTIAL','HumanReviewPublication':'BLOCKED'}
c['nextBatchesInOrder']=['HSK4-batch2 exact selected ordinals in hsk34-next-checkpoint.json','Reconcile existing HSK3/HSK2 instruction before duplicate gap lessons; mapped rows remain partial']
c['pending']=['HSK1 has292 vocabulary entries without draft teaching and unverified prerequisites','HSK2 grammar/topic/task subrequirements remain partial despite200 vocabulary entries','HSK3 grammar,60-character diagnostic scope,topic/task subrequirements and unsupported modalities remain partial','HSK4 still976 vocabulary entries plus remaining curriculum dimensions','Competent human language/key review and rights/publication decisions','Reviewed listening,speaking assessment,handwriting and valid free-writing evaluation','Authenticated online-policy extension for these drafts is not authorized','Full backup/restore and migration of owner history between retained sandboxes are not proved']
c['knownContentIssues']=['All original Vietnamese senses/examples/keys remain DRAFT,not human approved','37 historical expansion versions retained outside current activity counts','Reference counts do not prove complete instructional scope','HSK1/HSK2 prerequisites are not automatically mastered','Fresh selected sandbox retains old databases rather than merging their owner histories']
c['pendingVocabularyOrdinals']={'HSK1':[v['ordinal'] for v in read('docs/hsk24/coverage.json')['vocabulary'] if v['introductionLevel']==1 and v['status']!='CONTENT_DRAFT'],'HSK2':[],'HSK3':[],'HSK4':remaining}
c['latestMilestoneFinalizer']='scripts/finalize-hsk34.py (assertions are specific to this milestone)'
(root/'docs/hsk24/checkpoint.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
for f in ['hsk23-checkpoint.json','hsk23-next-checkpoint.json']:
 (root/'docs/hsk24'/f).write_text(json.dumps({'status':'HISTORICAL_CHECKPOINT_SUPERSEDED','historicalSnapshotCommit':baseline,'currentCheckpoint':'docs/hsk24/hsk34-next-checkpoint.json','currentVerification':'docs/hsk24/hsk34-verification.json','HSK3RemainingVocabularyOrdinals':[]},indent=2)+'\n',encoding='utf8')
report['proofFinalizerSha256']=digest('scripts/finalize-hsk34.py',True)
report['proofFinalizerScope']='Post-test document generation may be committed after the frozen app/content candidate; no runtime or package mutation.'
(root/'docs/hsk24/hsk34-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
g=h3['summary'];g4=h4['summary']
testrows='\n'.join(f"| {name} | {s['pass']} | {s['fail']} | {s['skipped']} |" for name,s in tests.items())
dbrows='\n'.join(f"| `{d['database']}` | {d['tables']['packages']['rows']} | {d['tables']['attempts']['rows']} | {d['tables']['sessions']['rows']} | {d['tables']['cards']['rows']} |" for d in before['databases'])
md=f'''# HSK3 vocabulary completion and HSK4 first teaching batch

Status: **HSK3_VOCABULARY_COMPLETE / HSK3_CURRICULUM_PARTIAL / HSK24_EPIC_PARTIAL**. All instructional content remains **DRAFT / DRAFT_UNREVIEWED / publication BLOCKED**, with no competent human language, answer or rights approval.

Branch: `feat/hsk24-curriculum`. This run starts at `{baseline}`. Frozen app/content candidate: `{report['sourceCandidateCommit']}`. Later documentation/technical-receipt commits are separate; resolve the current documentation HEAD with `git log -1 --format=%H -- docs/hsk24/hsk34-delivery.md`. No canonical backlog status was changed.

## Actual instruction

HSK3 now has **21 completed vocabulary batches**, including **17 new batches** in this run. Batch5 follows the saved L317–320 ordinal groups exactly. Successive batches add404 entries through batch21/L381–384. The result is **84 teaching units/lessons,672 exercises and500/500 distinct concept-linked source ordinals501–1000**. This run adds68 introductions/544 exercises. The final four lessons have five concepts each and a sixth explicit bounded sentence response; all retain eight exercises.

Each introduction has original Vietnamese usage/sense explanations, Mandarin examples and pinyin, prerequisites/glosses, a written dialogue/reading, contextual responses, feedback and ordering. The20-minute duration is an authoring estimate,not a measured learner completion guarantee. Some overlapping synonyms are tested only with an explicitly constrained word form. Typed short responses use declared exact normalization; unrestricted paraphrases/free writing are not objectively scored.

There are **15 additional HSK3 review/diagnostic activities and120 exercises**:4 unit reviews (4/84 units),1 condition-grammar diagnostic and10 sampled-character diagnostics covering60 distinct source-listed glyphs. They include familiar-context reading/ordering, altered retrieval modes and bounded typed responses. They are assisted practice,not official exam papers or independent proficiency evidence. Review activities reuse the registered original concept/sense and FSRS card identity for the selected source version.

HSK4 has **one actual batch,L401–404:4 units/lessons,24/1000 additional vocabulary entries and32 exercises**. Themes are registration/forms,travel/screening,office procedures and study/exam requirements. Grammar applications include按照,按时,在…方面 and不仅…还…. All four complete PostgreSQL initialization/grading/FSRS/progress checks. The course is locally PRACTICE_ONLY; this is not an empty course shell or an online release.

Current expansion totals: **194 activities/1,552 exercises**:HSK2=91/728,HSK3=99/792,HSK4=4/32. Four existing foundation/HSK1 activities remain separate (198 current overall). There are231 expansion manifest versions,including37 historical copies; with six base versions the server corpus has237 versions.

## Five-dimensional evidence

| Dimension | HSK3 | HSK4 |
| --- | --- | --- |
| Vocabulary draft instruction | 500/500 | 24/1000 |
| Physical grammar rows | {g['grammarRowsMappedCandidates']}/96 mapped;{g['grammarRowsWithExplicitPartialPractice']} have explicit partial teaching/practice links from this continuation | {g4['grammarRowsMappedCandidates']}/95 mapped with explicit partial lesson/order links |
| Recognition characters | {g['recognitionCharacterRefs']}/284 referenced;60 have dedicated assisted glyph practice | {g4['recognitionCharacterRefs']}/441 referenced;no dedicated glyph diagnostic |
| Topic leaves | {g['topicLeavesMapped']}/54 referenced written scenes | {g4['topicLeavesMapped']}/77 referenced written scenes |
| Communication heads | {g['taskHeadsReferenced']}/22 referenced;109 physical bullets enumerated | {g4['taskHeadsReferenced']}/30 referenced;139 physical bullets enumerated |
| Writing-character lists |150 required;handwriting unsupported |150 required;handwriting unsupported |
| Competent human review / publication |0 /blocked |0 /blocked |

Mapped,TAUGHT,PRACTICED,TECHNICALLY_VALIDATED,HUMAN_REVIEWED,PUBLISHED andLEARNER_MASTERED are distinct. No physical grammar row or task bullet is fully accepted. Multialternative grammar rows and functional subclauses remain partial even when a row has a lesson. Explicit grammar links select the actual exercises,including e1/e2 forL377,e0 forL378 ande0/reading context forL384; ordering is not automatically treated as evidence for every grammar reference.

The missing HSK3 recognition mapping is饺 (ordinal106). Source references283/284 do not imply all283 characters have been individually assessed. Listening,oral interaction,handwriting,reviewed native audio and valid open-writing evaluation remain unsupported; any optional browser TTS is synthetic reference,not listening/proficiency evidence.

The pinned406-page November2025 PDF has SHA256 `{h3['sourceSha256']}`. Official entry,reading,category and locator checks are separate from original Vietnamese sense/teaching interpretation. HSK4 boundaries are tasksPDF20–30,topics65–67,vocabulary104–128,recognition360–362 andgrammar394–396;writing is separatelyPDF378. The strict adapter rejects foreign-level and writing-page locators even with a forged matching evidence tuple. Source apostrophe/hyphen boundaries are normalized only for matching; tone differences are retained and a wrong-tone source query is rejected.

See [HSK3 matrix](hsk3-coverage.json),[explicit instruction links](hsk3-instruction-evidence.json),[HSK4 matrix](hsk4-coverage.json) and[all-level coverage](coverage.json). Existing text scenes should be checked before authoring duplicate gap lessons; a missing leaf reference is not automatically proof that no related scene exists.

## Tests actually accepted

| Group | PASS | FAIL | SKIPPED |
| --- | ---: | ---: | ---: |
{testrows}

That is119 unit cases,113 SQL cases (the single manifest case iterates all194 current expansion packages),and14 browser cases. Browser coverage includes desktop/360px,choice,pinyin,short,keyboard ordering,resume/reload,completion/progress,accessibility andToday reopening pinnedL404. It is Windows Chromium with mobile emulation,not physical Android UAT. Typecheck,lint and isolated production build each exit0.

The87-case HSK3 SQL run and8 HSK3 browser cases used frozen HSK3 source `d284063a0b01b7c105b1f2366499bcff03dc398c`. The later domain change adds only bounded HSK4 page support; current all-package unit validation and9 additional HSK3 SQL cases cover the unchanged HSK1–3 paths. HSK4 runtime/build checks use the final candidate. This source distinction is recorded rather than relabelling older logs as runs at a newer SHA.

One intermediate group reports35 PASS/1 FAIL/0 SKIPPED:all32 lesson cases passed,but source authoring had advanced to56 activities while the installed snapshot still had48. Catalog equality correctly rejected the mismatch. The final frozen87-case run passes without weakening that assertion;the failed log remains separate. The first HSK4 authoring attempt also failed closed before writes until the checked adapter gained the verified HSK4 bounds.

Production scanning checks1,848 private-key identifiers across32 client artifacts/966,566 bytes with0 hits. Development scanning checks the same identifiers across114 artifacts/31,904,131 bytes with0 hits. These totals include all scanned artifacts/maps,not the initial downloaded payload,and are not a formal leak proof. Every package's public projection is tested. [Local performance](hsk34-performance.json) records a237-version/server corpus of4,989,975 bytes,max public package43,461 bytes,catalog p50 about510ms,and9 SQL statements in each sampled level2/3/4 view. Timings are local under concurrent work,not a cloud SLA.

## Preservation and limits

All123 baseline expansion packages and650 source references remain unchanged. Version corrections are additive higher versions;original copies and attempts stay pinned. Current source/package hashes,private keys,owner isolation,secure prerequisites and no-independent-mastery behavior remain enforced.

Full serialized package-hash/attempt/session/card digests of these retained databases are unchanged between the before/after snapshots:

| Retained database | Packages | Attempts | Sessions | Cards |
| --- | ---: | ---: | ---: | ---: |
{dbrows}

The HSK3-stage database and other earlier sandboxes also remain retained. The final quiescent import preserves237 packages,78 attempts,213 sessions and57 cards in the new selected database before later representative browser writes. Import comparisons use full rows,not just counts. This is not a full backup/restore test. A fresh selected sandbox preserves old databases rather than merging their owner histories;review aliases reuse identities within their pinned source version,not a claimed global card/history migration between all versions.

HSK1 remains8/300 draft-taught entries,with292 missing andno prerequisite mastery granted. HSK2 remains200/200 vocabulary butcurriculum PARTIAL:30/78 grammar rows have explicit partial evidence,34 topic leaves are referenced,17 communication heads/76 physical bullets remain incomplete. This run does not restart HSK1/HSK2. Supporting glosses and references allow local exploratory practice while formal secure/mastery requirements remain unmet.

## Exact continuation

Next is **HSK4-batch2,L405–408**,descriptor `content/hsk24/batch32.authoring.json`. [Exact next checkpoint](hsk34-next-checkpoint.json) contains the next24 selected ordinals,the complete976 missing HSK4 ordinals,empty HSK3 missing-vocabulary set,and remaining HSK3 grammar/topic/recognition andHSK2 gaps. Check actual existing evidence before duplicate lessons. Future authoring must also reconcile the currentL4xx ID convention before that namespace is exhausted;the first four lessons do not prove capacity for all1,000 words under that convention.

Preview:[HSK4 local learning](http://127.0.0.1:3037/learn/courses/HSK4). Choose local saved learning if prompted. Reopen with `CSH_HSK3_CHECK_BUILD=1`,`CSH_HSK24_PREVIEW_PORT=3037` and `node scripts/hsk24-preview.mjs`. It uses an isolated local development identity/database,not authenticated human-owner proof or the hosted private preview.

No push,merge,deployment,live Supabase write,paid service,auth/RLS weakening,online allowlist extension,canonical task-status update or private answer-key client exposure occurred. The online Private Learning Preview remains unchanged. [Machine verification](hsk34-verification.json) contains actual raw-evidence hashes;final independent technical receipt is recorded separately and is never competent language or publication approval.
'''
(root/'docs/hsk24/hsk34-delivery.md').write_text(md,encoding='utf8')
readme=root/'docs/hsk24/README.md';s=readme.read_text('utf8');lines=s.splitlines();lines[2]='For current instruction,counts and execution evidence,read [HSK3 completion + HSK4 start](hsk34-delivery.md),[verification](hsk34-verification.json),[current checkpoint](checkpoint.json),[HSK3 matrix](hsk3-coverage.json),[HSK4 matrix](hsk4-coverage.json) and[exact next checkpoint](hsk34-next-checkpoint.json). Earlier batch/completion/continuation reports below are historical.';readme.write_text('\n'.join(lines)+'\n',encoding='utf8')
old=root/'docs/hsk24/hsk23-delivery.md';s=old.read_text('utf8');notice='> Historical checkpoint at55870a2. Current delivery:[HSK3 completion + HSK4 start](hsk34-delivery.md). Counts below are not current.\n\n'
if notice not in s:s=s.replace('\n\n','\n\n'+notice,1)
old.write_text(s,encoding='utf8')
print('Verified accepted logs: HSK3 500/500 /HSK4 24/1000,194 activities1552 exercises. Human review/publication still blocked.')

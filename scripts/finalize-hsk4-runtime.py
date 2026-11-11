"""Assemble this local 648-word milestone once; never rerun old finalizers.

Requires completed raw measurements/checks. This derives curriculum documents,
not Master Plan task status and not human/publication/mastery approval.
"""
import datetime, hashlib, json, re, subprocess
from pathlib import Path

root=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((root/p).read_text('utf-8-sig'))
sha=lambda p:hashlib.sha256((root/p).read_bytes()).hexdigest()
write=lambda p,x:(root/p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
git=lambda *args:subprocess.check_output(['git',*args],cwd=root)
base='69707d7e505a66b19eb3ee79fc0901523a94c657'
source='f9607b2e9587ffeb16efdae061171b1e1c31fa8a'
out='docs/hsk24/hsk4-runtime-verification.json'
assert not (root/out).exists(),'FROZEN_MILESTONE_ALREADY_EXISTS'
prefix='.local-postgres/hsk24/'
h=read('docs/hsk24/hsk4-coverage.json');old=json.loads(git('show',base+':docs/hsk24/hsk4-coverage.json'))
catalog=read('content/hsk24/catalog.json');manifest=read('content/hsk24/manifest.json');registry=read('content/hsk24/reviews.json')
current={l['currentVersion'] for l in catalog['lessons']};review={a['versionId']:a for a in registry['activities']}
packages=[read('content/hsk24/'+r['file']) for r in manifest['packages'] if r['versionId'] in current]
intros=[p for p in packages if p['lesson']['versionId'] not in review]
h4=[p for p in packages if p['alignment']['targetLevel']==4]
assert len(h4)==124 and h['vocabulary']['taught']==648
assert sum(len(p['exercises']) for p in h4)==992
before=read(prefix+'hsk4-runtime-batch22-20261029-before.json');after=read(prefix+'hsk4-runtime-batch22-20261029-after.json')
assert before['database']==after['database']=='csh_hsk24_bf294b6506c1'
for table,rows in before['tables'].items():
 assert all(after['tables'][table].get(k)==v for k,v in rows.items()),table
oldman=json.loads(git('show',base+':content/hsk24/manifest.json'))
for row in oldman['packages']:
 file='content/hsk24/'+row['file']
 assert git('show',base+':'+file).replace(b'\r\n',b'\n')==(root/file).read_bytes().replace(b'\r\n',b'\n'),file
oldevidence=json.loads(git('show',base+':content/hsk24/evidence.json'))
refs={r['id']:r for r in read('content/hsk24/evidence.json')['references']}
assert all(refs[r['id']]==r for r in oldevidence['references'])
native=read(prefix+'hsk4-runtime-final-f9607b2.json');cold=read(prefix+'hsk4-runtime-cold-final-f9607b2.json')
assert native['sourceCommit']==cold['sourceBaseCommit']==source
assert all(s['fullSourcePackages']==s['fullDatabaseManifests']==0 for s in native['samples'])
assert native['physicalConnections']==1 and native['poolAfterEnd']['total']==0
assert cold['compiledDevCachePresentBeforeStart'] is False and not cold['errors'] and cold['noPersistentRuntimeConnections']
checks=read(prefix+'hsk4-runtime-final-frozen-code-checks.json')
assert all(checks[k]==0 for k in ['unit','typecheck','lint','helperLint'])
assert read(prefix+'hsk4-runtime-build-exit.json')['exit']==0
assert all(read(prefix+f'hsk4-runtime-{kind}-client-isolation.json')['passed'] for kind in ['dev','prod'])
def counts(path):
 text=(root/path).read_text('utf8');values={}
 for key in ['tests','pass','fail','skipped']:
  m=re.search(r'(?:ℹ|#) '+key+r' (\d+)\b',text);assert m,(path,key);values[key]=int(m[1])
 assert values['fail']==values['skipped']==0,(path,values)
 return {'path':path,**values}
sql=[counts(prefix+f'hsk4-runtime-batch{b}-sql.log') for b in range(22,28)]
sql += [counts(prefix+'hsk4-runtime-'+n+'.log') for n in ['all-new-sql','repair-sql','wording-sql','final-existing-sql','final-index383-native']]
unit=counts(prefix+'hsk4-runtime-final-frozen-unit.log')
def cases(path):
 d=read(path)
 def visit(suites):
  for s in suites:
   yield from s.get('specs',[]);yield from visit(s.get('suites',[]))
 result=[]
 for s in visit(d['suites']):
  for t in s['tests']:
   result.append({'project':t['projectName'],'file':Path(s['file']).name,'title':s['title'],'status':t['results'][0]['status'] if t['results'] else 'notRun','annotations':t.get('annotations',[]),'source':path})
 return d['stats'],result
firstpath=prefix+'hsk4-runtime-final-browser.json';firststats,first=cases(firstpath)
assert firststats['expected']==7 and firststats['unexpected']==1 and firststats['skipped']==8
resumePath=prefix+'hsk4-runtime-resume-final-browser.json';resumeStats,resume=cases(resumePath)
mobilePath=prefix+'hsk4-runtime-mobile-cleared-browser.json';mobileStats,mobile=cases(mobilePath)
assert resumeStats['expected']==2 and mobileStats['expected']==8
assert all(x['unexpected']==x['skipped']==x['flaky']==0 for x in [resumeStats,mobileStats])
accepted=[x for x in first if x['status']=='passed']+resume+mobile
assert len(accepted)==17 and all(x['status']=='passed' for x in accepted)
branches=[a['description'] for c in accepted for a in c['annotations'] if a['type']=='today-priority-branch']
assert 'NO_DEBT_PINNED_RESUME' in branches and 'DUE_FSRS_BEFORE_RESUME' in branches
browser={'kind':'COMPOSITE_CURRENT_CASE_MATRIX','acceptedExecutions':{'pass':17,'fail':0,'skip':0},'distinctProjectCases':16,'extraExecution':'mobile Today repeated for both no-debt and due-debt branches','acceptedCases':accepted,'rawFirstRun':{'path':firstpath,'stats':firststats,'retainedFailure':'Shared owner created due FSRS cards; old fixture incorrectly required resume to outrank due review. Product follows the required priority.','traceArchive':prefix+'hsk4-runtime-browser-first-traces.zip'},'currentSources':{'runtimeAndContent':source,'todayFixture':git('rev-parse','HEAD').decode().strip()},'unchangedReusedDesktopFiles':['journey.spec.ts','navigation.spec.ts','schedule-refresh.spec.ts'],'transportLimit':'Browser server logs contain aborted/ECONNRESET messages around navigation. Functional cases passed; cause and general transport stability are not established by passing assertions.'}
browser['intermediateMobileFailure']={'path':prefix+'hsk4-runtime-mobile-final-browser.json','stats':read(prefix+'hsk4-runtime-mobile-final-browser.json')['stats'],'traceArchive':prefix+'hsk4-runtime-mobile-failed-traces.zip','observed':'TypeError reading length in generated Webpack chunk loader before HSK4 course heading; no application source frame.','controlledRerun':'Identical app/content; prior dev cache archived, new process/cache and synthetic owner. No request retries, timeout changes or source repair.','interpretation':'Passing a cleared-cache run supports a cache/process condition but does not prove its precise cause or general dev-cache stability.'}
write('docs/hsk24/hsk4-runtime-browser-evidence.json',browser)
remaining=h['vocabulary']['remainingOrdinals']
groups=[('Polite help and patience',[1043,1432,1462,1494,1521,1534]),('Sending and checking documents',[1328,1443,1643,1934,1392,1545]),('Standard language and fluent expression',[1562,1563,1484,1594,1529,1699]),('Choosing food and drinks',[1559,1560,1572,1583,1574,1794])]
selected=[n for _,g in groups for n in g];assert len(set(selected))==24 and set(selected)<=set(remaining)
nextp={'status':'HSK4_PARTIAL / LOCAL_RUNTIME_MEASURED / HUMAN_REVIEW_BLOCKED','nextHSK4Batch':28,'authoringFileToCreate':'content/hsk24/batch58.authoring.json','targetLessonIds':['L4025','L4026','L4027','L4028'],'namespaceImplemented':True,'groups':[{'theme':t,'ordinals':g} for t,g in groups],'exactSelectedOrdinals':selected,'nextSelectedOrdinal':selected[0],'lowestRemainingOrdinal':min(remaining),'allRemainingHSK4Ordinals':remaining,'database':before['database'],'preservationBaseline':prefix+'hsk4-runtime-batch22-20261029-before.json','coverageMatrix':'docs/hsk24/hsk4-coverage.json','instructionEvidence':'docs/hsk24/hsk4-instruction-evidence.json','qualifiedHumanReview':False,'publicationStatus':'BLOCKED','noAutomaticPrerequisiteMastery':True,'requiredBeforeAuthoring':'Confirm selected ordinals remain missing and preserve existing immutable versions. Use compatible local IDs; do not rerun old fixed-count milestone finalizers. Keep five-dimensional mapping exact and original Mandarin/Vietnamese provisional.','remainingLimits':['352 vocabulary entries not introduced','Metadata index still parsed per request; rejected candidate pages can grow','Cold and warm observations are local samples, no SLA','Browser navigation aborted/ECONNRESET logs retained; no general transport closure','Listening/speaking/handwriting/free writing unsupported','L403/L404 shallow ordering; L424 source pronoun slot not practiced','HSK1 incomplete; HSK2/3 curriculum partial; competent review and publication blocked']}
write('docs/hsk24/hsk4-production-next-checkpoint.json',nextp)
nextp['remainingLimits'].append('A generated Webpack chunk-loader TypeError was observed in a run reusing development cache; cleared-cache run is recorded separately, general dev-cache stability remains open')
write('docs/hsk24/hsk4-production-next-checkpoint.json',nextp)
sourceReview={'kind':'INDEPENDENT_READ_ONLY_AI_SOURCE_REVIEW','sourceCommit':source,'reviewer':'runtime_index_review_20261029','findings':'No blocking source issue found after bounded ID guard repair','independentReconstruction':{'records':383,'current':318,'indexBytes':1319365,'indexSha256':'4f6372377dbae46b35b913314505f2664e4b8d20fd59904d8d11fb9a5883b617','metadataHashesSourcePinsTupleOrderAdjacency':'PASS'},'reviewerWrites':False,'reviewerTestExecution':False,'reviewerDatabaseAccess':False,'limitations':['Metadata work is corpus-sized for index parse; candidate pages may increase','Measurements read from root receipts; reviewer did not execute checks','Browser/build conclusions belong to final packet review'],'humanReview':False,'publication':'BLOCKED'}
write('docs/hsk24/hsk4-runtime-source-review.json',sourceReview)
contentReview={'kind':'INDEPENDENT_READ_ONLY_AI_DRAFT_CONTENT_REVIEW','reviewer':'runtime_batch22_27_content_review','initialSource':'b4a8bf4106ced1fd22f79b77d146d50b908277e2','finalSource':source,'introductionIds':[f'L{n}' for n in range(4001,4025)],'reviewIds':[f'L{n}' for n in range(49001,49005)],'sourcePdfSha256':h['sourceSha256'],'inspected':{'vocabularySourceReadings':144,'grammarSubalternatives':24,'comprehensionQuestions':24,'sequenceExercises':24,'reviewExercises':32,'reusedReviewConcepts':24},'findings':[{'lesson':'L4008','issue':'P2 pinyin response cue contradicts glyph choices','resolved':'v2'},{'lesson':'L4017','issue':'P2 two-character response cue contradicts glyph choices','resolved':'v2'},{'lesson':'L4020','issue':'P2 cooking topic lacked a cooking scene','resolved':'v2 topic now 就餐'},{'lesson':'L4020','issue':'P2 食品/食物 answer ambiguity','resolved':'v2 explicit spelling cue and accurate feedback'},{'lesson':'L4008','issue':'P3 stale wording describes a pinyin exercise','resolved':'v3 learner-facing teaching/feedback'}],'repairRounds':2,'unresolvedFindings':[],'allPriorBytesAndConceptsPreserved':True,'reviewerWrites':False,'reviewerTestExecution':False,'competentHumanAttestation':None,'publicationStatus':'BLOCKED','learnerMastered':None,'limitation':'Original interpretations remain DRAFT; no prosody/listening/speaking/handwriting certification. Historical source-reference provenance note does not describe current exercise instructions.'}
write('docs/hsk24/hsk4-runtime-content-review.json',contentReview)
paths=[x['path'] for x in sql]+[unit['path'],firstpath,resumePath,mobilePath]
paths += [prefix+'hsk4-runtime-'+n for n in ['before-69707d7.json','final-f9607b2.json','cold-final-f9607b2.json','final-frozen-code-checks.json','final-database-content.json','source-reconciliation.json','build-exit.json','build.log','browser-fixture-code.json','source-audit-v2.log','instruction-audit-final.log','batch22-20261029-before.json','batch22-20261029-after.json','dev-client-isolation.json','dev-client-artifacts.zip','dev-client-artifacts.json','prod-client-isolation.json','prod-client-artifacts.zip','prod-client-artifacts.json']]
paths += ['docs/hsk24/'+p for p in ['hsk4-runtime-source-review.json','hsk4-runtime-content-review.json','hsk4-runtime-browser-evidence.json','hsk4-coverage.json','hsk4-instruction-evidence.json']]
paths += [prefix+'hsk4-runtime-'+n for n in ['mobile-final-browser.json','mobile-final-browser.log','mobile-failed-traces.zip','browser-first-traces.zip','id-advance-red.log','id-advance-green.log']]
report={'status':'VERIFIED_LOCAL_RUNTIME_OBSERVATIONS / HSK4_648_DRAFT / EPIC_PARTIAL','branch':'feat/hsk24-curriculum','baseline':base,'runtimeAndContentFrozenCommit':source,'assemblyHeadBeforeDocumentationCommit':git('rev-parse','HEAD').decode().strip(),'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'today':{'cause':'Each ordinary planner snapshot loaded/parsed the complete351 source packages plus351full DB manifests under the owner lock.','fix':'Validated derived metadata index plus dependency adjacency and live ordered metadata pages; per-request source-pin checks. Load a full body only for selected lesson or bounded review template. Offline import regenerates index; ordinary Today does not.','before':read(prefix+'hsk4-runtime-before-69707d7.json'),'after':native,'limits':['1,319,365byte metadata index still read/parsed each request; not O(1)','16metadata rows/page; max7new and7resume candidates retained; rejected pages can increase total work','Counts cover observed readFileSync/readdirSync/statSync and IO body objects, not every allocator/OS call']},'coldHttp':cold,'connectionPolicy':{'poolMax':3,'statementTimeoutMs':5000,'automaticRetries':0,'cronOrKeepaliveAdded':False,'cleanup':'Native pool0 and observed server connections0 after owned process stop'},'identifiers':{'compatibleNumericWidths':'3–6digits for local L IDs; all prior IDs/hash/history retained','newIntroductions':'L4001–L4024','newReviews':'L49001–L49004','uuid':'Existing values preserved, padded12digit numeric suffix for new UUIDs','order':'course/unit/lesson ordinal tuple, never lexical ID order','databaseColumnType':'text; no migration','privateOnlinePreview':'Existing explicit3digit allowlist intentionally unchanged','lateDefect':'Seed version-advance guard still3digits; red test/import rejection retained, corrected bounded extension with all safety guards unchanged'},'HSK4':{'completedBatches':list(range(22,28)),'newVocabulary':144,'vocabulary':648,'remaining':352,'newIntroductions':24,'newReviewActivities':4,'newExercises':224,'currentIntroductions':108,'currentReviews':16,'currentActivities':124,'currentExercises':992,'fiveDimensions':h['summary'],'baselineFiveDimensions':old['summary'],'delta':{k:h['summary'][k]-old['summary'][k] for k in old['summary'] if isinstance(old['summary'][k],int)},'fullyAcceptedGrammarRows':0,'fullyAcceptedTaskBullets':0,'qualifiedHumanReviews':0},'database':{'name':before['database'],'before':{k:len(v) for k,v in before['tables'].items()},'after':{k:len(v) for k,v in after['tables'].items()},'allRecordedOldRowsExact':True,'canonicalManifests':read(prefix+'hsk4-runtime-final-database-content.json'),'oldExpansionFilesPreserved':len(oldman['packages']),'oldSourceReferencesPreserved':len(oldevidence['references']),'totalServerVersions':383,'totalExpansionVersions':len(manifest['packages']),'currentExpansion':len(packages),'historicalExpansion':len(manifest['packages'])-len(packages),'limits':'Recorded row families/hash subsets, not full backup/restore proof'},'tests':{'unit':unit,'nativeSqlRuns':sql,'sqlExecutions':sum(x['pass'] for x in sql),'browser':browser,'typeLint':checks,'build':read(prefix+'hsk4-runtime-build-exit.json')},'intermediateFailures':{'browser':browser['rawFirstRun'],'idAdvance':{'redLog':prefix+'hsk4-runtime-id-advance-red.log','greenLog':prefix+'hsk4-runtime-id-advance-green.log','fixed':'Compatible ID guard; no other import protections removed'},'postgresServiceRecovery':'On continuation5447had no listener; existing project cluster recovered after interrupted shutdown. No init/reset/database switch. Initial import ECONNREFUSED and starting-up failure retained in execution evidence; preservation rechecked.','typecheck':'A negative test used nonexistent PUBLISHED enum; corrected to real APPROVED, final exit0.','measurementPrototype':'Earlier logs labelled69707d7 while running uncommitted intermediate code are advisory only; final native/cold reports pin exact f9607b2.','databaseVerifierPrototype':'Direct raw JSONB serialization hash was order-sensitive; typed canonical packageSchema parse plus deep equality matches all383. No DB content repair was made.'},'policy':{'localOnly':True,'push':False,'merge':False,'deploy':False,'cloudWrites':False,'paidResources':False,'authRlsWeakened':False,'masterPlanTaskStatusChanged':False,'publication':'BLOCKED','humanReview':False,'mastery':None},'limits':nextp['remainingLimits'],'nextCheckpoint':'docs/hsk24/hsk4-production-next-checkpoint.json','preview':'http://127.0.0.1:3037/learn/courses/HSK4','finalPacketReview':'docs/hsk24/hsk4-runtime-final-technical-review.json','evidenceFiles':{p:sha(p) for p in paths}}
write(out,report)
c=read('docs/hsk24/checkpoint.json')
c.update(verifiedOriginMain='ad7f4c59442b89701e5e41cd6a120284532c1650',completedBatch='HSK4-batch27',lessons=sorted(current),nextBatchFile=nextp['authoringFileToCreate'],nextBatchToAuthor='HSK4-batch28',resumeCommand='Follow hsk4-production-next-checkpoint.json in same bf database; additive imports only.',verification=out,currentRunBaseCommit=base,newBatchesThisContinuation=6,newHSK4BatchesThisContinuation=6,currentIntroductionLessonCount=len(intros),currentExpandedLessonCount=len(packages),currentExpandedExerciseCount=sum(len(p['exercises']) for p in packages),historicalExpansionVersionCount=len(manifest['packages'])-len(packages),HSK4LessonCount=108,HSK4ExerciseCount=864,HSK4ReviewActivityCount=16,HSK4ReviewExerciseCount=128,currentLessonCount=len(packages),currentExerciseCount=sum(len(p['exercises']) for p in packages),historicalVersionCount=len(manifest['packages'])-len(packages),coverageSha256=sha('docs/hsk24/coverage.json'),nextCheckpoint=report['nextCheckpoint'],latestMilestoneFinalizer='scripts/finalize-hsk4-runtime.py; single-use648milestone',pending=report['limits'],knownContentIssues=report['limits'],nextBatchesInOrder=['HSK4-batch28 L4025–L4028 exact24selectedordinals','Continue352missingwords with five-dimensional gaps; keep DRAFT human gates'],independentFinalTechnicalReview=report['finalPacketReview'],technicalReviewReceipt=report['finalPacketReview'])
for field in ['remainingNewVocabulary','coverageVocabulary','pendingVocabularyOrdinals']:
 c.setdefault(field,{})['HSK4']={'remainingNewVocabulary':352,'coverageVocabulary':648,'pendingVocabularyOrdinals':remaining}[field]
c['completedBatches']=list(dict.fromkeys(c['completedBatches']+[f'HSK4-batch{n}' for n in range(22,28)]))
c['currentMilestones']['HSK4Vocabulary']='648_OF_1000_DRAFT'
acts=[a for a in registry['activities'] if a['versionId'] in current]
c.update(unitReviewCount=sum(a['kind']=='UNIT_REVIEW' for a in acts),diagnosticCount=sum(a['kind'].endswith('DIAGNOSTIC') for a in acts),newHSK2GapLessonsThisContinuation=0,newHSK3BatchesThisContinuation=0)
c['historicalRuntimeContinuationBefore648']=c['latestRuntimeContinuation']
c['latestRuntimeContinuation']={'sourceCommit':source,'verification':out,'delivery':'docs/hsk24/hsk4-runtime-delivery.md','ordinaryTodayFullBodyReads':0,'metadataIndexStillParsed':True,'coldInitialization':'MEASURED_FRESH_PROCESS_AND_CLEARED_COMPILED_CACHE','developmentCacheTransportStability':'OPEN; retained generated-chunk and aborted/JSON parse logs','contentAdded':144,'technicalReviewReceipt':report['finalPacketReview']}
if isinstance(c.get('vocabulary'),dict):c['vocabulary']['4']=648
write('docs/hsk24/checkpoint.json',c)
summary=f'''# HSK4 runtime + batches22–27 — local delivery

Đã thêm **144 mục từ,24 bài dạy,4 bài ôn,224 bài tập**. HSK4 đạt **648/1000**, còn352; tổng108bài dạy+16bài ôn=124hoạt động/992bài tập. DRAFT_UNREVIEWED, publication BLOCKED, không cấp mastery.

1. Branch `feat/hsk24-curriculum`; runtime/nội dung đóng băng `{source}`. Commit tài liệu sau đó không được gán ngược cho phép đo. HEAD bàn giao cuối ghi trong thông báo Git của chat.
2. Today trước đọc351gói nguồn+351manifest DB đầy đủ dưới khóa chủ sở hữu. Chỉ mục metadata có hash/pin, dependency adjacency và truy vấn metadata theo trang thay đường đọc toàn bộ nội dung; bản đầy đủ chỉ tải khi mở bài cụ thể. Nhập offline cập nhật index, không dựng lại mỗi yêu cầu.
3. Đo native:351→0gói nguồn,351→0body DB;365→14thao tác filesystem,34→23SQL. Lần đầu1089,5→99,3ms; warm trước707,9–996,2ms, sau32,3–33,7ms. Đây là quan sát cùng DB/chủ sở hữu đo trên các ảnh chụp khác nhau, không phải SLA. Index hiện1.319.365byte vẫn đọc/parse mỗi yêu cầu;16dòng/trang và7ứng viên mới/7resume được giữ, số trang có thể tăng khi loại quyền/phiên.
4. Tiến trình Next mới, cache biên dịch đã chuyển sang kho lưu: status đầu6,99s, Today đầu385,6ms, warm53,5–53,8ms. PostgreSQL và cache hệ điều hành không bị xóa. NămHTTP200, không timeout/503/retry trong lượt cold này.
5. Kết nối đầu35,8ms; một kết nối được dùng lại, pool về0; sau dừng tiến trình đo, kết nối ứng dụng về0. Pool tối đa3, statement timeout5s và giới hạn fetch15/20s giữ nguyên. Log browser có aborted/ECONNRESET quanh điều hướng; chưa đủ dữ kiện kết luận nguyên nhân hoặc độ ổn định tổng quát.
6. ID local3–6chữ số, UUID cũ giữ nguyên; thứ tự course/unit/lesson theo ordinal. Đã bắt bằng red test và sửa guard nâng version còn ba chữ số; DBtext không cần migration. Private owner preview online giữ allowlist cũ.
7. Đã nhập và commit batch22–27;24mục đầu batch22 khớp checkpoint đã lưu. Bài dạy L4001–L4024; ôn L49001–L49004 dùng nguyên nguồn sense/thẻ.
8. Từ vựng504→648/1000, +144mục duy nhất. Bài ôn không cộng từ mới.
9. Tăng24bài dạy+4bài ôn/224bài tập. Ba v2 và một v3 sửa câu chữ/tham chiếu được thêm riêng; không ghi đè bản cũ.
10. Ngữ pháp67→90/95hàng có ánh xạ;64→87tiểu mẫu dạy/luyện. Chữ248→314/441có tham chiếu;103→135chữ được luyện nhận diện có gợi ý,118→155câu luyện. Chủ đề52→66/77; đầu nhiệm vụ19→24/30. Không chấp nhận trọn hàng ngữ pháp hay139bullet nhiệm vụ; không chứng nhận nghe/nói/viết tay/tự luận.
11. Unit29/0/0; SQL/native tổng{report['tests']['sqlExecutions']}lượt đạt trên các bộ được liệt kê riêng; browser17lượt đạt/16ca khác nhau, gồm cả hai nhánh Today. Raw đầu7PASS/1FAIL/8chưa chạy được giữ: fixture yêu cầu resume vượt FSRS; test sửa kiểm tra đúng ưu tiên và không xóa lịch sử. Typecheck/lint/helper lint/build exit0. Giữ nguyên351binding/2337attempt/1180session/1650card cũ theo từng hash trên cùng `{before['database']}`;383manifest hiện khớp nguồn,7migration/19bảng FORCE RLS giữ nguyên. Đây không phải chứng minh fullbackup/restore.
12. Mốc tiếp: batch28, `content/hsk24/batch58.authoring.json`, L4025–L4028,24ordinal cụ thể trong [checkpoint](hsk4-production-next-checkpoint.json). Không chạy lại finalizer của mốc504.
13. Preview local: [HSK4](http://127.0.0.1:3037/learn/courses/HSK4). Chỉ development; online owner preview không được deploy/thay đổi.
14. Các thay đổi được commit cục bộ; trạng thái cây cuối được kiểm tra sau commit báo cáo/receipt. Không push,merge,deploy,cloud hay paid resource.

[Bằng chứng có hash](hsk4-runtime-verification.json), [ma trận browser](hsk4-runtime-browser-evidence.json), [AI content review](hsk4-runtime-content-review.json), [AI source review](hsk4-runtime-source-review.json), [review độc lập packet cuối](hsk4-runtime-final-technical-review.json). Review AI chỉ đọc không thay competent human approval. Epic còn PARTIAL.
'''
(root/'docs/hsk24/hsk4-runtime-delivery.md').write_text(summary,encoding='utf8')
with (root/'docs/hsk24/hsk4-runtime-delivery.md').open('a',encoding='utf8') as f:
 f.write('\nGiới hạn bổ sung: lượt mobile dùng lại cache dev gặp TypeError trong chunk loader Webpack (0 PASS/1 FAIL/7 chưa chạy). Đã lưu cache và trace, rồi kiểm tra lại cùng mã với cache biên dịch mới. Kết quả chạy sạch không chứng minh chính xác nguyên nhân; tính ổn định khi dùng lại cache dev còn mở.\n')
print('Assembled648draft milestone; final packet review is a separate read-only receipt.')

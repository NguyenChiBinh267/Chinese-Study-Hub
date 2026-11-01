"""Vocabulary continuation: actual draft links, separate new SQL scope; no human attestation.
Do not rerun historical milestone finalizers to overwrite these derived reports.
"""
import hashlib,json,re,runpy,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((root/p).read_text('utf8'))
runpy.run_path(str(root/'scripts/audit-hsk34-instruction.py'))
catalog=read('content/hsk24/catalog.json');manifest=read('content/hsk24/manifest.json');registry=read('content/hsk24/reviews.json')
current={x['currentVersion'] for x in catalog['lessons']};activities={a['versionId']:a for a in registry['activities']}
packages=[p for row in manifest['packages'] if row['versionId'] in current and (p:=read('content/hsk24/'+row['file']))['alignment']['targetLevel']==4]
intros=[p for p in packages if p['lesson']['versionId'] not in activities]
assert all(len(p["exercises"])==8 for p in packages)
bindings={x['lessonId']:x for x in read('docs/hsk24/hsk4-grammar-row-bindings.json')['bindings']}
ledger=read('docs/hsk24/hsk4-vocabulary-run-checkpoint.json')
validatedVersions=set(ledger['validatedVersions']);validated=bool(validatedVersions)
h4=read('docs/hsk24/hsk4-coverage.json');grammar=[];scenes=[];glyphs=[]
for p in packages:
 version=p['lesson']['versionId'];pid=p['lesson']['id'];keys={k['id']:k for k in p['privateKeys']}
 if version not in activities:
  block=next(b for b in p['blocks'] if b['type']=='teaching' and b['id'].endswith('-grammar'))
  reading=next(b for b in p['blocks'] if b['type']=='teaching' and b['id'].endswith('-reading'))
  e=p['exercises'][7];assert e['type']=='sequence'
  adequate=len(e['choices'])>=3 and bindings[pid]['partialPracticeAccepted']
  if 437<=int(pid[1:])<=492:assert adequate
  for ref in p['alignment']['grammarReferences']:
   grammar.append({'lessonId':pid,'versionId':version,'packageHash':p['packageHash'],'sourceReferenceId':ref['id'],'teachingBlockId':block['id'],'explanation':block['text'],'practiceExerciseIds':[e['id']] if adequate else [],'practicePrompt':e['prompt'],'scope':'EXPLICIT_SUBALTERNATIVE_TAUGHT_PRACTICED_DRAFT' if adequate else 'LEGACY_SHALLOW_ORDERING_OR_SOURCE_PRONOUN_SLOT_NOT_PRACTICED','technicallyValidated':version in validatedVersions,'technicalEvidence':'docs/hsk24/hsk4-vocabulary-verification.json' if version in validatedVersions else 'docs/hsk24/hsk4-continuous-verification.json','humanReviewed':False,'published':False,'learnerMastered':None})
  scenes.append({'lessonId':pid,'versionId':version,'packageHash':p['packageHash'],'readingBlockId':reading['id'],'comprehensionExerciseId':p['exercises'][6]['id'],'objective':p['lesson']['objectives'][0],'topicReferenceIds':[v['id'] for v in p['alignment']['topicReferences']],'taskReferenceIds':[v['id'] for v in p['alignment']['taskReferences']],'taskHeads':[v['sourceLocator']['entry'] for v in p['alignment']['taskReferences']],'scope':'WRITTEN_RECEPTION_AND_BOUNDED_RESPONSE_PARTIAL; parent task/topic linkage does not accept all subclauses or oral interaction.','technicallyValidated':version in validatedVersions,'technicalEvidence':'docs/hsk24/hsk4-vocabulary-verification.json' if version in validatedVersions else 'docs/hsk24/hsk4-continuous-verification.json','humanReviewed':False,'published':False,'learnerMastered':None})
 for e in p['exercises']:
  if e['skill']!='recognition':continue
  accepted=keys[e['keyRef']]['accepted'];assert len(accepted)==1 and len(accepted[0])==1
  c=accepted[0];refs=[v for v in p['alignment']['characterReferences'] if v['written']==c and v['status']=='VERIFIED' and v['officialLevel']==4];assert refs,(pid,c)
  glyphs.append({'lessonId':pid,'versionId':version,'packageHash':p['packageHash'],'exerciseId':e['id'],'character':c,'sourceReferenceId':refs[0]['id'],'sourceOrdinal':refs[0]['ordinal'],'scope':'ASSISTED_GLYPH_RECOGNITION_DRAFT_WITH_MEANING_PINYIN_CUES','activityKind':activities.get(version,{}).get('kind','INTRODUCTION'),'technicallyValidated':version in validatedVersions,'technicalEvidence':'docs/hsk24/hsk4-vocabulary-verification.json' if version in validatedVersions else 'docs/hsk24/hsk4-continuous-verification.json','humanReviewed':False,'published':False,'learnerMastered':None})
for row in h4['grammar']:
 row['instructionEvidence']=[x for x in grammar if x['sourceReferenceId'] in row['sourceReferenceIds']]
 row['instructionalState']='EXPLICIT_SUBALTERNATIVE_TAUGHT_PRACTICED_DRAFT' if any(x['practiceExerciseIds'] for x in row['instructionEvidence']) else 'MAPPED_DRAFT_WITH_PRACTICE_SCOPE_GAP' if row['instructionEvidence'] else 'NOT_MAPPED';row['fullyAccepted']=False
for row in h4['topics']:
 row['writtenSceneEvidence']=[x for x in scenes if any(r in row['sourceReferenceIds'] for r in x['topicReferenceIds'])]
 row['state']='WRITTEN_SCENE_PARTIAL' if row['writtenSceneEvidence'] else 'NOT_MAPPED';row['fullyAccepted']=False
for row in h4['recognition']:
 row['practiceEvidence']=[x for x in glyphs if x['sourceOrdinal']==row['ordinal']]
 row['dedicatedPractice']=bool(row['practiceEvidence']);row['handwriting']='UNSUPPORTED'
for row in h4['taskSubrequirements']:
 row['parentHeadSceneLinks']=[x for x in scenes if row['task'] in x['taskHeads']]
 row['mappingMeaning']='Parent-head written scene only; this physical bullet and all its functional/modal subclauses are not accepted.'
 row['fullyAccepted']=False
h4['summary'].update(grammarRowsWithExplicitPartialPractice=sum(any(x['practiceExerciseIds'] for x in r['instructionEvidence']) for r in h4['grammar']),recognitionCharactersExplicitlyPracticed=len({x['character'] for x in glyphs}),recognitionPracticeExercises=len(glyphs),fullyAcceptedGrammarRows=0,fullyAcceptedTaskBullets=0,qualifiedHumanReviews=0)
h4['legacyShallowGrammarOrdering']=[x['versionId'] for x in grammar if x['lessonId'] in ['L403','L404']]
h4['sourceSlotPracticeGaps']=[{'versionId':x['versionId'],'reason':bindings[x['lessonId']]['limitation']} for x in grammar if x['lessonId']=='L424']
for x in grammar:x.update(sourceRowId=bindings[x['lessonId']]['sourceRowId'],practiceGap=bindings[x['lessonId']]['limitation'] if not x['practiceExerciseIds'] else None)
h4['reviews']={'activities':[{'versionId':p['lesson']['versionId'],'kind':activities[p['lesson']['versionId']]['kind'],'exercises':len(p['exercises'])} for p in packages if p['lesson']['versionId'] in activities],'exercises':sum(len(p['exercises']) for p in packages if p['lesson']['versionId'] in activities),'sampledDiagnosticCharacters':len({x['character'] for x in glyphs if x['activityKind']=='CHARACTER_DIAGNOSTIC'}),'newVocabulary':0,'cardIdentity':'Exact immutable origin version/hash/concept reused; no global history or cross-version card migration claim.'}
h4['status']=('HSK4_VOCABULARY_COMPLETE / HSK4_CURRICULUM_PARTIAL / HSK24_EPIC_PARTIAL' if h4['vocabulary']['taught']==1000 and not h4['vocabulary']['remainingOrdinals'] else 'HSK4_PARTIAL / HSK24_EPIC_PARTIAL')
all_current_in_scope=all(p['lesson']['versionId'] in validatedVersions for p in packages)
h4['stages']={'identified':'1000 vocabulary ordinals,95 physical grammar rows,77 topic leaves,30 task heads/139 bullets,441 recognition/150 writing glyphs','mapped':'Exact source locators; separate from instructional completeness','taughtPracticed':'See actual immutable teaching, ordering, written scenes and glyph exercise links','technicallyValidated':all_current_in_scope,'technicalEvidence':'docs/hsk24/hsk4-vocabulary-verification.json','technicalScope':'Per-version flags and currentRunSqlScope; current run does not re-grade every historical introduction.','qualifiedHumanReview':False,'published':False,'learnerMastered':None}
out={'status':h4['status'],'sourceSha256':h4['sourceSha256'],'scope':'Current HSK4 activities only; original Mandarin/Vietnamese remains provisional. Each grammar link is only its explicit subalternative. No full physical-row/task/skill completion.','grammarApplications':grammar,'writtenCommunicationScenes':scenes,'characterPractice':glyphs,'technicalRuntimeValidated':all_current_in_scope,'listedCurrentRunScopeValidated':validated,'currentRunScopeMeaning':'Only listed exact versions; manifest-resume checks cover the entire current catalog separately. No full grading or human-review claim for versions outside this run.','currentRunSqlScope':sorted(validatedVersions),'humanReview':None,'publicationStatus':'BLOCKED','learnerMastered':None}
for path,obj in [('docs/hsk24/hsk4-coverage.json',h4),('docs/hsk24/hsk4-instruction-evidence.json',out)]:
 (root/path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('HSK4',h4['vocabulary']['taught'],h4['summary'],'reviews',len(h4['reviews']['activities']),'all current in this grading scope',all_current_in_scope,'listed scope validated',validated)

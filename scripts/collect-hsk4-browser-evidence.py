"""Account for distinct current cases from retained raw runs, including failures."""
import json,hashlib,subprocess
from pathlib import Path
read=lambda p:json.loads(Path(p).read_text('utf8'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
runs=[('.local-postgres/hsk24/hsk4-continuous-browser-attempt2.json','reuse_unchanged_desktop_journeys',5),('.local-postgres/hsk24/hsk4-continuous-desktop-final.json','desktop_navigation_today',3),('.local-postgres/hsk24/hsk4-continuous-mobile-final.json','mobile_representative',4)]
def specs(suites):
 for s in suites:
  yield from s.get('specs',[])
  yield from specs(s.get('suites',[]))
accepted=[];raw=[]
for path,mode,count in runs:
 d=read(path);selected=[]
 for spec in specs(d['suites']):
  for test in spec['tests']:
   if mode=='reuse_unchanged_desktop_journeys' and (test['projectName']!='desktop' or Path(spec['file']).name!='journey.spec.ts'):continue
   assert len(test['results'])==1 and test['results'][0]['status'] in ['passed','failed'],(path,spec['title'],test['status'])
   if mode!='mobile_representative':assert test['results'][0]['status']=='passed'
   key=test['projectName']+'|'+Path(spec['file']).name+'|'+spec['title']
   selected.append({'key':key,'rawSpecId':spec['id'],'source':path,'status':test['results'][0]['status'],'durationMs':test['results'][0]['duration'],'retry':test['results'][0]['retry']})
 assert len(selected)==count,(path,len(selected))
 if mode=='desktop_navigation_today':assert d['stats']['unexpected']==d['stats']['flaky']==d['stats']['skipped']==0
 if mode=='mobile_representative':assert d['stats']['expected']==3 and d['stats']['unexpected']==1 and d['stats']['skipped']==d['stats']['flaky']==0
 accepted+=selected;raw.append({'path':path,'sha256':sha(path),'rawStats':d['stats'],'selectedCases':count})
assert len(accepted)==len({x['key'] for x in accepted})==12
f='tests/hsk24-browser/journey.spec.ts';old=subprocess.check_output(['git','show','ff2b46c9d7bdee9d29b29e0563c4c60be5e6d1dd:'+f]);assert old.replace(b'\r\n',b'\n')==Path(f).read_bytes().replace(b'\r\n',b'\n')
out={'kind':'COMPOSITE_CURRENT_CASE_MATRIX_NOT_A_PLAYWRIGHT_RAW_REPORT','acceptedCounts':{'pass':11,'fail':1,'skipped':0,'flaky':0},'closureReady':False,'openFailure':'MobileToday remains on schedule after save;15s navigation assertion fails.','rawRuns':raw,'acceptedCases':accepted,'reuseRationale':'Five desktop journey cases passed before a state-label assumption failed in the separate navigation test. Journey source, app runtime and lesson bytes remain unchanged; rerun navigation/Today plus a representative mobile journey, first/last navigation and Today. Last mobileToday failed and remains a FAIL; no retries or failed cases count as passes.','intermediateBrowserFailures':[{'run':'attempt1','observedCompletedFailures':1,'aggregate':'Aborted; partial traces only; complete firsttrace/rawlog lost in archive/rerun race'},{'run':runs[0][0],'rawCounts':{'pass':5,'fail':1,'skipped':10},'reason':'Navigation test expected initial Luyện label after preceding journey had completed the lesson; actual Luyện lại link and pinned URL were correct. State-aware test now preserves exact URL/title checks.'}],'cliDiscoveryError':{'path':'.local-postgres/hsk24/hsk4-continuous-browser-cli-discovery-error.log','testsExecuted':0,'reason':'Variadic --project consumed following filenames; corrected --project=desktop before actual rerun.'}}
Path('docs/hsk24/hsk4-continuous-browser-evidence.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
assert sum(x['status']=='passed' for x in accepted)==11 and sum(x['status']=='failed' for x in accepted)==1
print('Current12-case matrix:11PASS/1FAIL/0SKIP; rawparent5/1/10 remains explicit.')

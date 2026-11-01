// One real Next process restart; no hidden retries or warmup requests.
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { Client } from "pg";

const name=process.argv[2];
if(!/^hsk4-runtime-cold-[a-z0-9-]+$/.test(name??""))throw Error("BOUNDED_COLD_REPORT_REQUIRED");
const base=".local-postgres/hsk24/",output=base+name+".json";
if(fs.existsSync(output))throw Error("REPORT_ALREADY_EXISTS");
const pointer=JSON.parse(fs.readFileSync(base+"current.json","utf8"));
const state=JSON.parse(fs.readFileSync(pointer.stateFile,"utf8"));
const owner=JSON.parse(fs.readFileSync(base+"hsk4-runtime-measurement-owner.json","utf8"));
const url=new URL(state.runtimeUrl);
if(state.database!==owner.database || url.hostname!=="127.0.0.1" || url.port!=="5447" || url.username!=="csh_runtime")throw Error("SELECTED_LOCAL_DATABASE_REQUIRED");
const report={startedAt:new Date().toISOString(),sourceBaseCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),database:state.database,port:3037,compiledDevCachePresentBeforeStart:fs.existsSync(".next/hsk3-check/dev"),freshNodeProcess:true,applicationCatalogCache:false,requests:[],errors:[],observationRequestBudgetMs:90000,automaticRetries:0,limits:"Direct HTTP observations allow90s to measure compilation; product15s/20s fetch and5s SQL limits are unchanged. Each record explicitly flags whether it exceeds its application fetch budget. Cold first process is not a fresh client against an existing server."};
const observer=new Client({connectionString:state.runtimeUrl,application_name:"hsk4-cold-readonly-observer"});
await observer.connect();
const connections=async()=> (await observer.query("SELECT pid,state FROM pg_stat_activity WHERE usename=current_user AND application_name='csh-local-runtime' ORDER BY pid")).rows;
report.connectionsBefore=await connections();
if(report.connectionsBefore.length)throw Error("UNEXPECTED_EXISTING_RUNTIME_CONNECTIONS");
const stdout=fs.createWriteStream(base+name+".stdout.log",{flags:"wx"}),stderr=fs.createWriteStream(base+name+".stderr.log",{flags:"wx"});
const started=performance.now();
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--webpack","--no-server-fast-refresh","--hostname","127.0.0.1","--port","3037"],{windowsHide:true,stdio:["ignore","pipe","pipe"],env:{...process.env,CSH_HSK3_CHECK_BUILD:"1",CSH_APP_MODE:"LOCAL_DATABASE_DEV",CSH_LOCAL_CURRICULUM:"hsk24-batch1",CSH_LOCAL_DATABASE:"1",CSH_APP_ORIGIN:"http://127.0.0.1:3037",CSH_LOCAL_OWNER_ID:owner.owner,DATABASE_URL:state.runtimeUrl}});
report.childPid=child.pid;
let cookie="";
async function probe(path,phase,budget=15000,options={}) {
  const at=performance.now();
  try {
    const response=await fetch("http://127.0.0.1:3037"+path,{...options,headers:{Origin:"http://127.0.0.1:3037",...(cookie?{Cookie:cookie}:{}),...options.headers},signal:AbortSignal.timeout(90000)});
    const body=await response.text();
    const set=response.headers.getSetCookie();if(set.length)cookie=set.map(c=>c.split(";")[0]).join("; ");
    const elapsed=performance.now()-at;
    report.requests.push({phase,path,status:response.status,responseBytes:Buffer.byteLength(body),wallMs:elapsed,applicationFetchBudgetMs:budget,exceedsApplicationFetchBudget:elapsed>budget,serverErrorCode:response.ok?null:(()=>{try{return JSON.parse(body).error?.code??null;}catch{return "NON_JSON_ERROR";}})()});
    if(!response.ok)throw Error(`HTTP_${response.status}:${path}`);
  }catch(error){report.errors.push({phase,path,message:error.message});throw error;}
}
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error("NEXT_READY_TIMEOUT")),60000);
    child.once("exit",code=>{clearTimeout(timeout);reject(Error("NEXT_EXIT_BEFORE_READY:"+code));});
    child.stdout.on("data",b=>{stdout.write(b);if(String(b).includes("Ready in")){clearTimeout(timeout);resolve();}});
    child.stderr.on("data",b=>stderr.write(b));
  });
  report.processReadyMs=performance.now()-started;
  await probe("/api/local/status","FIRST_HTTP_IN_COLD_PROCESS",20000);
  await probe("/api/local/mode","LOCAL_MODE_SETUP",20000,{method:"POST",headers:{"Content-Type":"application/json","x-csh-local":"1"},body:JSON.stringify({local:true})});
  await probe("/api/local/study/today","FIRST_TODAY_HTTP_IN_COLD_PROCESS");
  report.connectionsAfterFirst=await connections();
  await probe("/api/local/study/today","WARM_TODAY_HTTP");
  await probe("/api/local/study/today","WARM_TODAY_HTTP");
  report.connectionsAfterWarm=await connections();
}catch(error){report.failure=error.message;process.exitCode=1;}
finally {
  if(child.pid && child.exitCode===null) {
    if(process.platform==="win32")execFileSync("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});
    else child.kill("SIGTERM");
  }
  report.connectionsAfterProcessStop=await connections();
  await observer.end();stdout.end();stderr.end();
  report.totalMs=performance.now()-started;
  report.noPersistentRuntimeConnections=report.connectionsAfterProcessStop.length===0;
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({report:output,requests:report.requests,errors:report.errors,noPersistentRuntimeConnections:report.noPersistentRuntimeConnections}));
}

const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),assert=require('node:assert/strict');
const {AgentHub,startAgentBridge}=require('../src/main/agent-hub.cjs');
const source=process.argv.includes('--source');
const exe=source?require('electron'):path.resolve(process.argv[2]||'dist/win-unpacked/Nyapix.exe');
function run(args,input='',env=process.env){return new Promise((resolve,reject)=>{
  const child=spawn(exe,source?['.',...args]:args,{windowsHide:true,env,stdio:['pipe','pipe','pipe']});let out='',err='';
  const timer=setTimeout(()=>{child.kill();reject(new Error('Packaged test timed out'));},45000);
  child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.on('error',reject);
  child.on('exit',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error(`${args.join(' ')}: Exit ${code}: ${err} ${out}`));});child.stdin.end(input);
});}
(async()=>{
  const smoke=await run(['--nyapix-smoke-test']);
  const result=JSON.parse(smoke.trim());
  assert.equal(result.pixel,true);assert.equal(result.reactions,true);
  if(process.env.NYAPIX_TEST_EXPECT_NO_WEBGL==='1')assert.equal(result.graphicsFallback,true);
  else assert.equal(result.threeD,true);
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'nyapix-release-relay-'));
  const hub=new AgentHub();const bridge=await startAgentBridge(hub,{home});
  try {
    const output=await run(['--nyapix-agent-relay','codex'],JSON.stringify({hook_event_name:'UserPromptSubmit',session_id:'packaged-test'}),{...process.env,USERPROFILE:home,HOME:home});
    assert.equal(output.trim(),'{}');assert.equal(hub.snapshot().focus.phase,'thinking');
    console.log(JSON.stringify({result:'PASS',executable:path.basename(exe),bundledRelay:true,smoke:JSON.parse(smoke.trim())}));
  } finally {bridge.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});

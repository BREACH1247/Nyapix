// Temporary transparent proxy: observe real hooks, forward to the running pet,
// and restore the discovery file byte-for-byte. Never records other sessions.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
(async () => {
  const descriptor = path.join(os.homedir(), '.nyapix/bridge.json');
  const original = fs.readFileSync(descriptor);
  const bridge = JSON.parse(original);
  const events = [];
  let session, replacement;
  const proxy = http.createServer((req,res) => {
    const chunks=[];
    req.on('data', c=>chunks.push(c));
    req.on('end', () => {
      const body=Buffer.concat(chunks);
      const upstream=http.request({hostname:'127.0.0.1',port:bridge.port,path:req.url,method:req.method,headers:req.headers}, response=>{
        try {
          const event=JSON.parse(body);
          if(event.provider==='codex')events.push({session:event.session,phase:event.phase,event:event.event,text:event.text,status:response.statusCode});
        }catch{}
        res.writeHead(response.statusCode);response.pipe(res);
      });
      upstream.setTimeout(2000,()=>upstream.destroy());
      upstream.on('error',()=>{res.writeHead(502);res.end();});upstream.end(body);
    });
  });
  try {
    await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
    replacement=JSON.stringify({...bridge,port:proxy.address().port});
    fs.writeFileSync(descriptor,replacement);
    const child=spawn('codex',['exec','--ephemeral','-s','read-only','--json','This is a Nyapix cat connection smoke test. Do not use tools, read files, or modify anything. Reply exactly: Nyapix cat connection confirmed.'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='',errors='';
    child.stdout.on('data',c=>output+=c);
    child.stderr.on('data',c=>errors+=c);
    const timer=setTimeout(()=>child.kill(),45000);
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});clearTimeout(timer);
    for(const line of output.split('\n'))try { const packet=JSON.parse(line);if(packet.type==='thread.started')session=packet.thread_id; }catch{}
    await new Promise(r=>setTimeout(r,800));
    const own=events.filter(e=>e.session===session);
    console.log(JSON.stringify({codexExit:code,matchedEvents:own.length,observedEvents:events.map(e=>({event:e.event,phase:e.phase,status:e.status,matchesTest:e.session===session})),hookWarnings:errors.split('\n').filter(line=>/hook|trust/i.test(line))}));
    assert.equal(code,0,'Codex test run failed');
    assert(own.some(e=>e.phase==='thinking'&&e.status===204),'No accepted thinking hook received');
    assert(own.some(e=>e.phase==='done'&&e.status===204&&e.text==='Nyapix cat connection confirmed.'),'No accepted completion hook with reply received');
    console.log(JSON.stringify({result:'PASS',source:'real Codex CLI hooks',events:own.map(({event,phase,status})=>({event,phase,status})),reply:'Nyapix cat connection confirmed.'}));
  } finally {
    if(replacement && fs.readFileSync(descriptor,'utf8')===replacement)fs.writeFileSync(descriptor,original);
    proxy.close();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});

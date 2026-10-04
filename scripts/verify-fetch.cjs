const {app,BrowserWindow}=require('electron');
const path=require('node:path'),assert=require('node:assert/strict');
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{offscreen:true,backgroundThrottling:false}});
  try{
    await win.loadFile(path.join(__dirname,'../src/preview/index.html'));
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const {NyapixCat}=await import('../cat/engine.js');
      const {bindFetch}=await import('../cat/fetch.js');
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;document.body.append(canvas);
      const p=new NyapixCat(canvas,{soundEnabled:false,routinesEnabled:false});p.setDisplay(1000,700,{left:25,top:24,right:30,bottom:45});
      const check=(v,m)=>{if(!v)throw new Error(m);};let trips=0;
      for(const kind of ['cat','dog'])for(const mode of ${JSON.stringify(process.env.NYAPIX_TEST_EXPECT_NO_WEBGL==='1'?['pixel']:['pixel','3d'])}){
        p.setSettings({petKind:kind,renderMode:mode});p.x=620;p.y=430;p.rememberHome();p.startRoutine('fetch');
        if(mode==='3d'){for(let i=0;i<150&&!p.render3D?.rig;i++){p.draw();await new Promise(r=>setTimeout(r,30));}check(p.render3D?.rig,'3D initialization');}
        const f=p.fetch;check(p.hitTest(f.x,f.y),'toy hit target');check(f.grab(f.x,f.y,0),'grab');f.move(240,250,100);f.release(101);
        const phases=new Set();
        for(let i=0;i<1600&&f.phase!=='ready';i++){
          p.update(.016);phases.add(f.phase);
          check(p.x>=33&&p.y>=32,'pet work-area bounds');
          check(f.x>=25&&f.x<=970&&f.y>=24&&f.y<=655,'toy work-area bounds');
          if(f.phase==='return'){p.draw();if(mode==='3d')check(p.render3D.toy.visible,'3D carrying toy');}
        }
        check(phases.has('chase')&&phases.has('pickup')&&phases.has('return'),'full fetch sequence');
        check(f.phase==='ready'&&p.x===620&&p.y===430,'exact return');check(p.homeX===620&&p.homeY===430,'home preserved');
        f.grab(f.x,f.y,0);f.move(-20000,20000,100);f.release(500);
        check(f.vx===0&&f.vy===0,'held still drops without stale fling');
        p.quiet=true;p.update(.016);check(!p.fetch&&p.x===620,'quiet cancels safely');p.quiet=false;trips++;
      }
      p.setSettings({renderMode:'pixel'});p.startRoutine('fetch');p.settings.paused=true;p.update(.016);check(!p.fetch,'pause cancels');p.settings.paused=false;
      p.startRoutine('fetch');p.setDisplay(600,400,{});check(!p.fetch,'resize cancels');
      p.startRoutine('fetch');p.setAgentEvent({provider:'codex',phase:'thinking',activity:'editing'});p.update(.016);check(!p.fetch,'agent interrupts');
      p.setAgentEvent({provider:'codex',phase:'idle'});p.think=false;p.mode='idle';p.startRoutine('fetch');
      let held=false,ignore;canvas.setPointerCapture=()=>held=true;canvas.hasPointerCapture=()=>held;canvas.releasePointerCapture=()=>held=false;
      bindFetch(canvas,p,v=>ignore=v);let bodyGrabs=0;canvas.addEventListener('pointerdown',()=>bodyGrabs++);
      const x=p.fetch.x,y=p.fetch.y;
      canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,button:0,clientX:x,clientY:y,bubbles:true}));
      check(held&&ignore===false&&bodyGrabs===0,'toy owns pointer capture');
      canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:7,bubbles:true}));
      check(!held&&!p.fetch,'cancel releases capture');
      return {trips,exactReturn:true,bounds:true,interruptions:true,pointerCapture:true};
    })()`);
    assert(result.trips>=2);
    await win.loadFile(path.join(__dirname,'../src/preview/index.html'));
    await win.webContents.executeJavaScript(`(()=>{
      document.getElementById('asDog').click();
      const p=window.__nyapix;p.setSettings({renderMode:'pixel',soundEnabled:false});
      p.mode='idle';p.startRoutine('fetch');p.say('Drag the purple toy to play fetch!');p.draw();
    })()`);
    await new Promise(r=>setTimeout(r,500));
    const shot=path.join(require('node:os').tmpdir(),'nyapix-fetch.png');require('node:fs').writeFileSync(shot,(await win.capturePage()).toPNG());
    console.log(JSON.stringify({result:'PASS',...result,screenshot:shot}));app.exit(0);
  }catch(e){console.error(e);app.exit(1);}
});

const { app, BrowserWindow } = require('electron');
require('../src/main/test-graphics.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show:false, width:1100, height:950, webPreferences:{ offscreen:true, backgroundThrottling:false } });
  const errors=[];
  win.webContents.on('console-message', (_,level,message)=>{ if(level>=3)errors.push(message); });
  try {
    await win.loadFile(path.join(__dirname,'../src/settings/index.html'),{query:{pet:'dog',mode:'3d'}});
    const checks = await win.webContents.executeJavaScript(`(async()=>{
      const pet=window.__nyapixPreview;
      for(let i=0;i<100&&!pet.render3D?.rig;i++) await new Promise(r=>setTimeout(r,50));
      if(!pet.render3D?.rig)throw new Error('3D unavailable');
      const theme=document.getElementById('theme');
      theme.value='dark';theme.dispatchEvent(new Event('input',{bubbles:true}));
      const dark=document.documentElement.dataset.theme==='dark';
      const bg=getComputedStyle(document.body).backgroundColor;
      theme.value='light';theme.dispatchEvent(new Event('input',{bubbles:true}));
      const light=document.documentElement.dataset.theme==='light';
      theme.value='dark';theme.dispatchEvent(new Event('input',{bubbles:true}));
      pet.setSettings({spotifyEnabled:true});pet.music={playing:true};pet.mode='idle';pet.idleT=89;
      pet.update(2);pet.draw();const dancing=pet.vibing&&pet.mode==='idle';
      const musicNote=!!pet.musicIndicator;
      pet.music={playing:false};pet.draw();const stopped=!pet.vibing&&!pet.musicIndicator;
      pet.music={playing:true};pet.mode='think';pet.draw();const priority=!pet.vibing&&!!pet.musicIndicator;
      pet.settings.paused=true;pet.draw();const pausedNote=!pet.musicIndicator;pet.settings.paused=false;
      const noteCanvas=document.createElement('canvas');noteCanvas.width=100;noteCanvas.height=100;
      const noteContext=noteCanvas.getContext('2d');
      pet.drawMusicIndicator(noteContext,{x:0,y:0,w:96,h:96},false);
      const pixelNote=noteContext.getImageData(0,0,100,100).data.some((v,i)=>i%4===3&&v>0);
      pet.mode='idle';pet.setSettings({spotifyEnabled:false});pet.draw();const disabled=!pet.vibing&&!pet.musicIndicator;
      pet.previewFit=false;pet.setSettings({scale:3});pet.keycaps=[];pet.spawnKeycap('A');const small=Math.abs(pet.keycaps[0].vy);
      pet.setSettings({scale:8});pet.keycaps=[];pet.spawnKeycap('A');const big=Math.abs(pet.keycaps[0].vy);
      for(let i=0;i<30;i++)pet.spawnKeycap('A');const capped=pet.keycaps.length===8;
      pet.previewFit=true;pet.setSettings({scale:5});pet.keycaps=[];pet.mode='idle';
      return {dark,light,bg,dancing,musicNote,pixelNote,pausedNote,stopped,priority,disabled,capped,scaled:big>small*1.5};
    })()`);
    for(const [key,value] of Object.entries(checks))if(key!=='bg')assert.equal(value,true,key);
    assert.deepEqual(errors,[]);
    await new Promise(r=>setTimeout(r,500));
    const output=path.join(require('node:os').tmpdir(),'nyapix-dark.png');
    fs.writeFileSync(output,(await win.webContents.capturePage()).toPNG());
    console.log(JSON.stringify({result:'PASS',...checks,screenshot:output}));
    app.exit(0);
  }catch(error){console.error(error,errors);app.exit(1);}
});

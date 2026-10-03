const {app,BrowserWindow,ipcMain}=require('electron');
require('../src/main/test-graphics.cjs');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
app.whenReady().then(async()=>{
  let saved={petKind:'dog',renderMode:'pixel',soundEnabled:false}, menuCalls=0;
  ipcMain.handle('settings:get',()=>saved);
  ipcMain.handle('settings:set',(_,patch)=>saved={...saved,...patch});
  ipcMain.handle('music:get',()=>({playing:false}));
  ipcMain.handle('quiet:get',()=>({available:true,quiet:false}));
  ipcMain.handle('agents:get',()=>({focus:{phase:'idle'},sessions:[],history:[],integrations:[]}));
  ipcMain.handle('display:list',()=>[{id:'2',label:'Second screen'}]);
  ipcMain.handle('display:insets',()=>({left:0,top:0,right:0,bottom:0}));
  ipcMain.handle('calendar:upcoming',()=>({events:[]}));
  ipcMain.on('ignore-mouse',()=>{});ipcMain.on('pet-menu',()=>menuCalls++);
  const errors=[];
  const win=new BrowserWindow({show:false,width:1100,height:1000,webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.join(__dirname,'../src/main/preload-settings.js')}});
  win.webContents.on('console-message',(_,level,message)=>{if(level>=3)errors.push(message);});
  const run=fn=>win.webContents.executeJavaScript(`(${fn.toString()})()`);
  try {
    await win.loadFile(path.join(__dirname,'../src/settings/index.html'));
    await new Promise(r=>setTimeout(r,400));
    const result=await run(async()=>{
      const pet=window.__nyapixPreview;
      const set=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};
      set('petName','Mochi');set('accessory','bow');set('musicStyle','dance');
      document.getElementById('favoriteName').value='My bow';document.getElementById('saveFavorite').click();
      set('accessory','none');document.querySelector('#favorites button').click();
      const favorite=pet.settings.accessory==='bow'&&pet.settings.petName==='Mochi';
      const {PET_DEFAULTS}=await import('../shared/defaults.js');
      const sheet=document.createElement('canvas');sheet.width=900;sheet.height=600;
      const ctx=sheet.getContext('2d');ctx.fillStyle='#26332c';ctx.fillRect(0,0,900,600);ctx.imageSmoothingEnabled=false;
      let checks=0;
      for(const [row,combo] of [['dog','pixel'],['cat','pixel'],['dog','3d'],['cat','3d']].entries()) {
        const [petKind,renderMode]=combo;pet.setSettings({...PET_DEFAULTS[petKind],petKind,renderMode,accessory:'bow'});
        if(renderMode==='3d')for(let i=0;i<100&&!pet.render3D?.rig;i++){pet.draw();await new Promise(r=>setTimeout(r,20));}
        const poses=new Set();
        for(const [col,mode] of ['groom','chase','toy','sleep','edit','test'].entries()) {
          pet.mode=mode;pet.modeT=1.2;pet.tailT=2;pet.think=false;pet.agentInfo=null;pet.draw();
          poses.add(pet.canvas.toDataURL());
          const r=pet.catRect();ctx.drawImage(pet.canvas,r.x,r.y,r.w,r.h,col*150+15,row*150+10,120,120);
          ctx.fillStyle='#edf1ea';ctx.font='11px Segoe UI';ctx.fillText(petKind+' '+renderMode+' '+mode,col*150+5,row*150+144);
        }
        if(poses.size!==6)throw new Error('Duplicate poses: '+combo);checks++;
      }
      pet.mode='idle';pet.agentInfo=null;pet.think=false;pet.startRoutine('groom');pet.update(5.1);const routineEnds=pet.mode==='idle';
      pet.setAgentEvent({provider:'codex',phase:'thinking',activity:'editing'});pet.update(.05);const editing=pet.mode==='edit';
      const priority=!pet.startRoutine('toy');
      pet.setAgentEvent({provider:'codex',phase:'thinking',activity:'testing'});pet.update(.05);const testing=pet.mode==='test';
      pet.setAgentEvent({provider:'codex',phase:'waiting'});const waiting=pet.mode==='waiting';
      pet.agentInfo=null;pet.think=false;pet.mode='idle';pet.previewFit=false;pet.setDisplay(1000,700,{left:10,top:25,right:0,bottom:40});
      pet.setSettings({homeCorner:'top-left'});pet.placeDefault();const corner=pet.x===26&&pet.y===41;
      pet.setSettings({homeCorner:'bottom-right'});pet.placeDefault();const bottom=pet.x>700&&pet.y>400;
      return {favorite,checks,routineEnds,editing,testing,waiting,priority,corner,bottom,sheet:sheet.toDataURL()};
    });
    for(const key of ['favorite','routineEnds','editing','testing','waiting','priority','corner','bottom'])assert(result[key],key);
    const output=path.join(require('node:os').tmpdir(),'nyapix-routines.png');fs.writeFileSync(output,Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
    await new Promise(r=>setTimeout(r,150));
    await win.reload();await new Promise(r=>setTimeout(r,400));
    assert(await run(()=>document.getElementById('petName').value==='Mochi'&&document.querySelectorAll('#favorites .chip').length===1),'Saved preferences reload');
    const overlay=new BrowserWindow({show:false,width:1000,height:700,webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.join(__dirname,'../src/main/preload-overlay.js')}});
    overlay.webContents.on('console-message',(_,level,message)=>{if(level>=3)errors.push(message);});
    saved={petKind:'cat',renderMode:'pixel',soundEnabled:false,quietAuto:true,quietFocus:false,quietManual:false};
    await overlay.loadFile(path.join(__dirname,'../src/overlay/index.html'));await new Promise(r=>setTimeout(r,350));
    const visible=()=>overlay.webContents.executeJavaScript(`document.getElementById('stage').style.visibility`);
    overlay.webContents.send('quiet',{quiet:true,available:true});await new Promise(r=>setTimeout(r,150));assert.equal(await visible(),'hidden');
    overlay.webContents.send('quiet',{quiet:false,available:true});await new Promise(r=>setTimeout(r,150));assert.equal(await visible(),'visible');
    overlay.webContents.send('settings',{...saved,quietFocus:true,pomodoroEnabled:true,pomodoroFocus:25});await new Promise(r=>setTimeout(r,150));assert.equal(await visible(),'hidden');
    overlay.webContents.send('settings',{...saved,pomodoroEnabled:false});await new Promise(r=>setTimeout(r,150));assert.equal(await visible(),'visible');
    await overlay.webContents.executeJavaScript(`document.getElementById('stage').dispatchEvent(new MouseEvent('contextmenu',{clientX:innerWidth-96,clientY:innerHeight-108,bubbles:true}))`);
    await new Promise(r=>setTimeout(r,100));assert.equal(menuCalls,1,'Pet right click opens menu');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({result:'PASS',...result,persistence:true,quietRestore:true,focusQuiet:true,contextMenu:true,screenshot:output}));app.exit(0);
  }catch(e){console.error(e,errors);app.exit(1);}
});

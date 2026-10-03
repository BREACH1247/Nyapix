const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path');
app.whenReady().then(async()=>{
  try {
    const {uIOhook}=require('uiohook-napi');uIOhook.start();uIOhook.stop();
    const calendar=require('node-ical').parseICS('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:smoke\r\nDTSTART:20261003T120000Z\r\nSUMMARY:Smoke test\r\nEND:VEVENT\r\nEND:VCALENDAR');
    if(!calendar.smoke)throw new Error('Calendar parser failed');
    ipcMain.handle('settings:get',()=>({petKind:'cat',renderMode:'3d',soundEnabled:false}));
    ipcMain.handle('settings:set',(_,patch)=>patch);
    ipcMain.handle('music:get',()=>({playing:false}));
    ipcMain.handle('display:list',()=>[]);
    ipcMain.handle('agents:get',()=>({focus:{phase:'idle'},sessions:[],history:[],integrations:[]}));
    ipcMain.handle('calendar:upcoming',()=>({events:[]}));
    const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false,preload:path.join(__dirname,'preload-settings.js')}});
    await win.loadFile(path.join(__dirname,'../settings/index.html'));
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const pet=window.__nyapixPreview;
      for(let i=0;i<150&&!pet.render3D?.rig;i++){await new Promise(r=>setTimeout(r,40));pet.draw();if(pet.renderError)throw new Error(pet.renderError);}
      if(!pet.render3D?.rig)throw new Error('Packaged 3D model did not render');
      pet.setAgentEvent({provider:'codex',phase:'thinking',activity:'testing'});pet.draw();if(pet.mode!=='test')throw new Error('Reaction failed');
      pet.setSettings({renderMode:'pixel'});pet.mode='idle';pet.draw();if(!pet._lastGrid)throw new Error('Pixel art failed');
      return {pixel:true,threeD:true,reactions:true};
    })()`);
    console.log(JSON.stringify({packaged:app.isPackaged,version:app.getVersion(),nativeInput:true,calendar:true,...result}));app.exit(0);
  }catch(e){console.error(e);app.exit(1);}
});

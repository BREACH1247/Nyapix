const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
app.whenReady().then(async()=>{
  try {
    const win=new BrowserWindow({show:false});
    await win.loadFile(path.join(__dirname,'../src/settings/index.html'));
    const data=await win.webContents.executeJavaScript(`(async()=>{
      const {drawCatArt}=await import('../cat/art.js');
      const {DEFAULTS}=await import('../shared/defaults.js');
      const pet=window.__nyapixPreview;pet.settings={...DEFAULTS,furColor:'#e7bb7b',markColor:'#a8683f',pattern:'tabby'};pet.mode='idle';pet.blink=0;pet.lookX=pet.lookY=0;
      const sprite=document.createElement('canvas');sprite.width=sprite.height=32;drawCatArt(sprite.getContext('2d'),pet);
      const icon=document.createElement('canvas');icon.width=icon.height=256;const ctx=icon.getContext('2d');
      ctx.fillStyle='#263e35';ctx.beginPath();ctx.roundRect(0,0,256,256,52);ctx.fill();ctx.imageSmoothingEnabled=false;ctx.drawImage(sprite,24,12,208,208);
      return icon.toDataURL();
    })()`);
    const png=Buffer.from(data.split(',')[1],'base64');
    const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
    const dir=path.join(__dirname,'../build');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'icon.ico'),Buffer.concat([header,png]));fs.writeFileSync(path.join(dir,'icon.png'),png);
    console.log('Generated original Nyapix app icon');app.exit(0);
  }catch(e){console.error(e);app.exit(1);}
});

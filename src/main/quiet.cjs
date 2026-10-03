const {spawn} = require('node:child_process');
const path = require('node:path');
function startQuiet(onChange) {
  let state = {available:false, quiet:false}, proc;
  if (process.platform !== 'win32') return {snapshot:()=>state,stop(){}};
  proc=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'quiet.ps1')],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  let buffer='', last=Date.now();
  const emit=next=>{state=next;onChange(next);};
  proc.stdout.on('data',chunk=>{
    buffer+=chunk.toString();if(buffer.length>8192)buffer='';
    const lines=buffer.split(/\r?\n/);buffer=lines.pop();
    for(const line of lines)try {const p=JSON.parse(line);last=Date.now();emit({available:p.available===true,quiet:p.quiet===true,reason:p.reason});}catch{}
  });
  const fail=()=>emit({available:false,quiet:false});
  proc.on('error',fail);proc.on('exit',fail);
  const watchdog=setInterval(()=>{if(Date.now()-last>12000){clearInterval(watchdog);proc.kill();fail();}},5000);watchdog.unref();
  return {snapshot:()=>state,stop(){clearInterval(watchdog);proc.kill();}};
}
module.exports={startQuiet};

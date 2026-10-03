const {app}=require('electron');
const flag=process.argv.indexOf('--nyapix-agent-relay');
if(flag>=0){
  app.disableHardwareAcceleration();
  // Hook subprocesses must not open the running companion's Chromium profile.
  app.setPath('userData',require('node:path').join(require('node:os').homedir(),'.nyapix','relay-runtime'));
  app.whenReady().then(()=>require('./agent-relay.cjs').runCli(process.argv[flag+1],()=>app.exit(0)));
}else{
  // Isolated packaged smoke tests never touch the user's live settings or hooks.
  const smoke=process.argv.indexOf('--nyapix-smoke-test');
  if(smoke>=0){
    const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
    app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'nyapix-packaged-')));
    require('./packaged-check.cjs');
  }else require('./index.js');
}

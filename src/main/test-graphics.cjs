// Opt-in software graphics for isolated tests on GPU-less Intel Mac runners.
// The normal application entry never loads this module.
if(process.env.NYAPIX_TEST_SOFTWARE_GL==='1'){
  const {app}=require('electron');
  app.commandLine.appendSwitch('use-gl','angle');
  app.commandLine.appendSwitch('use-angle','swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  // Only these isolated, local-file tests run without the GPU subprocess sandbox.
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

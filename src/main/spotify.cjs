const { spawn } = require('node:child_process');
const path = require('node:path');
function startSpotify(onChange) {
  let child, enabled = false, state = { state: 'disabled', playing: false }, last = 0;
  const emit = (next) => { state = next; onChange(state); };
  const watchdog = setInterval(() => {
    if (child && Date.now() - last > 15000) { child.kill(); child = null; emit({ state: 'unavailable', playing: false }); }
  }, 5000);
  watchdog.unref();
  function setEnabled(value) {
    if (enabled === !!value) return;
    enabled = !!value;
    if (child) { child.kill(); child = null; }
    if (!enabled) return emit({ state: 'disabled', playing: false });
    if (process.platform !== 'win32') return emit({ state: 'unsupported', playing: false });
    emit({ state: 'connecting', playing: false }); last = Date.now();
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'spotify.ps1')], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    child = proc;
    let buffer = '';
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', chunk => {
      if (child !== proc) return;
      buffer += chunk;
      if (buffer.length > 65536) buffer = '';
      const lines = buffer.split(/\r?\n/); buffer = lines.pop();
      for (const line of lines) try {
        const packet = JSON.parse(line); last = Date.now();
        emit({ state: ['ready','waiting','unavailable'].includes(packet.state) ? packet.state : 'unavailable', playing: packet.playing === true, title: String(packet.title || '').slice(0,200), artist: String(packet.artist || '').slice(0,200) });
      } catch {}
    });
    const failed = () => { if (child === proc) { child = null; emit({ state: 'unavailable', playing: false }); } };
    proc.on('error', failed); proc.on('exit', failed);
  }
  return { setEnabled, snapshot: () => state, stop() { clearInterval(watchdog); enabled = false; const proc = child; child = null; proc?.kill(); } };
}
module.exports = { startSpotify };

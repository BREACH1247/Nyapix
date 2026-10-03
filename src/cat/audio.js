export class PixelAudio {
  constructor() {
    this.ctx = null;
    this.purrNodes = null;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  meow(pitch = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(780 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(240 * pitch, t + 0.16);
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(1800, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(filt).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  bark() {
    const ctx = this.ensure();
    if (!ctx) return;
    for (const delay of [0, 0.16]) {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.09);
      filter.type = "lowpass";
      filter.frequency.value = 900;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.07, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  purrMix(level = 0.5) {
    const intensity = Math.min(1, Math.max(0.12, level / 1.45));
    return {
      vol: 0.055 + intensity * 0.08,
      rate: 22 + intensity * 5.5,
      bodyHz: 98 + intensity * 10,
    };
  }

  purrStart(level = 0.5) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const mix = this.purrMix(level);

    if (this.purrNodes) {
      const n = this.purrNodes;
      n.stopping = false;
      n.master.gain.cancelScheduledValues(t);
      n.master.gain.setTargetAtTime(mix.vol, t, 0.1);
      n.pulse.frequency.setTargetAtTime(mix.rate, t, 0.18);
      n.carrier.frequency.setTargetAtTime(mix.bodyHz, t, 0.22);
      n.sub.frequency.setTargetAtTime(mix.bodyHz * 0.5, t, 0.22);
      return;
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(mix.vol, t + 0.36);

    const warm = ctx.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 640;
    warm.Q.value = 0.55;

    const carrier = ctx.createOscillator();
    carrier.type = "triangle";
    carrier.frequency.value = mix.bodyHz;
    const carrierGain = ctx.createGain();
    carrierGain.gain.setValueAtTime(0.5, t);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = mix.bodyHz * 0.5;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.18;

    const formant = ctx.createOscillator();
    formant.type = "sine";
    formant.frequency.value = 168;
    const formantGain = ctx.createGain();
    formantGain.gain.value = 0.09;

    const pulse = ctx.createOscillator();
    pulse.type = "sine";
    pulse.frequency.value = mix.rate;
    const bodyPulse = ctx.createGain();
    bodyPulse.gain.value = 0.38;
    pulse.connect(bodyPulse);
    bodyPulse.connect(carrierGain.gain);

    const n = Math.floor(ctx.sampleRate * 0.7);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < n; i++) {
      brown = brown * 0.985 + (Math.random() * 2 - 1) * 0.015;
      data[i] = Math.max(-1, Math.min(1, brown * 12));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const rasp = ctx.createBiquadFilter();
    rasp.type = "bandpass";
    rasp.frequency.value = 175;
    rasp.Q.value = 3.4;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.11, t);
    const raspPulse = ctx.createGain();
    raspPulse.gain.value = 0.09;
    pulse.connect(raspPulse);
    raspPulse.connect(noiseGain.gain);

    const breath = ctx.createOscillator();
    breath.type = "sine";
    breath.frequency.value = 1.15;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.035;
    breath.connect(breathDepth);
    breathDepth.connect(noiseGain.gain);

    carrier.connect(carrierGain).connect(warm);
    sub.connect(subGain).connect(warm);
    formant.connect(formantGain).connect(warm);
    noise.connect(rasp).connect(noiseGain).connect(warm);
    warm.connect(master).connect(ctx.destination);

    carrier.start(t);
    sub.start(t);
    formant.start(t);
    pulse.start(t);
    breath.start(t);
    noise.start(t);

    this.purrNodes = {
      carrier,
      sub,
      formant,
      pulse,
      breath,
      noise,
      master,
      stopping: false,
    };
  }

  purrStop() {
    if (!this.purrNodes || this.purrNodes.stopping) return;
    const nodes = this.purrNodes;
    nodes.stopping = true;
    const t = this.ctx.currentTime;
    nodes.master.gain.cancelScheduledValues(t);
    nodes.master.gain.setTargetAtTime(0.0001, t, 0.22);
    const token = nodes;
    setTimeout(() => {
      if (this.purrNodes !== token) return;
      for (const name of [
        "carrier",
        "sub",
        "formant",
        "pulse",
        "breath",
        "noise",
      ]) {
        try {
          token[name].stop();
        } catch {
          /* already stopped */
        }
      }
      this.purrNodes = null;
    }, 520);
  }

  pop() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.11);
  }
}

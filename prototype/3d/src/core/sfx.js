export function createSfx({ basePath = './assets/sounds/' } = {}) {
  let ac = null;
  const cache = {};

  function getAC() {
    if (!ac) {
      try {
        ac = new AudioContext();
      } catch {
        ac = null;
      }
    }
    return ac;
  }

  async function load(url) {
    if (cache[url]) return cache[url];
    const a = getAC();
    if (!a) return null;
    try {
      const r = await fetch(url);
      const buf = await r.arrayBuffer();
      const decoded = await a.decodeAudioData(buf);
      cache[url] = decoded;
      return decoded;
    } catch {
      return null;
    }
  }

  function play(url, vol = 1) {
    const a = getAC();
    if (!a) return;
    load(url).then(buf => {
      if (!buf) return;
      const src = a.createBufferSource();
      src.buffer = buf;
      const g = a.createGain();
      g.gain.value = vol;
      src.connect(g);
      g.connect(a.destination);
      src.start();
    });
  }

  const P = basePath;
  let _si = 0;

  return {
    resume() {
      getAC()?.resume();
    },
    swing() {
      const ff = ['swoshes/swosh-18', 'swoshes/swosh-20', 'swoshes/swosh-16'];
      play(P + ff[_si++ % 3] + '.ogg', 0.55);
    },
    hitBone() {
      const v = ['hit_bone', 'hit_bone2', 'hit_bone3'][Math.floor(Math.random() * 3)];
      play(P + v + '.ogg', 0.75);
    },
    hitWood() {
      play(P + 'hit_wood.ogg', 0.65);
    },
    hitFlesh() {
      play(P + (Math.random() < 0.5 ? 'hit_flesh' : 'hit_flesh2') + '.ogg', 0.6);
    },
    stomp() {
      play(P + 'stomp.ogg', 0.85);
      play(P + 'stomp2.ogg', 0.4);
    },
    kick() {
      play(P + 'hit_bone.ogg', 0.6);
    },
    thrust() {
      const ff = ['swoshes/swosh-18', 'swoshes/swosh-29'];
      play(P + ff[Math.floor(Math.random() * 2)] + '.ogg', 0.6);
    },
    _spinSrc: null,
    _spinGain: null,
    spinPlay(dur) {
      const url = P + 'swoshes/swosh-23.ogg';
      load(url).then(buf => {
        if (!buf) return;
        const a = getAC();
        const t0 = a.currentTime;
        const s = a.createBufferSource();
        const g = a.createGain();
        s.buffer = buf;
        g.gain.setValueAtTime(0.6, t0);
        g.gain.setValueAtTime(0.6, t0 + Math.max(0, dur - 0.3));
        g.gain.linearRampToValueAtTime(0, t0 + dur);
        s.connect(g);
        g.connect(a.destination);
        this._spinSrc = s;
        this._spinGain = g;
        s.start();
        s.stop(t0 + dur + 0.05);
        s.onended = () => {
          this._spinSrc = null;
          this._spinGain = null;
        };
      });
    },
    spinStop() {
      if (this._spinSrc && this._spinGain) {
        const a = getAC();
        const g = this._spinGain.gain;
        const t = a.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(0.6, t);
        g.linearRampToValueAtTime(0, t + 0.15);
        try {
          this._spinSrc.stop(t + 0.16);
        } catch {}
        this._spinSrc = null;
        this._spinGain = null;
      }
    },
    dodge() {
      play(P + (Math.random() < 0.5 ? 'dodge' : 'dodge2') + '.ogg', 0.4);
    },
    rise() {
      const ff = ['swoshes/swosh-33', 'swoshes/swosh-26'];
      play(P + ff[_si++ % 2] + '.ogg', 0.5);
    },
    drill() {
      play(P + 'stomp.ogg', 0.9);
    },
    chop() {
      play(P + 'swoshes/swosh-03.ogg', 0.7);
    },
  };
}

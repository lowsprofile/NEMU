import RingBuffer from "ringbufferjs";

export default class Speaker {
  constructor(opts = {}) {
    const defaultOpts = {
      onBufferUnderrun: undefined,
      bufferSize: 8192,
    };

    this.opts = Object.assign({}, defaultOpts, opts);
    this.buffer = new RingBuffer(this.opts.bufferSize * 2);
  }

  start() {
    // Audio is not supported
    if (!window.AudioContext) {
      return;
    }
    this.audioCtx = new window.AudioContext();
    this.scriptNode = this.audioCtx.createScriptProcessor(1024, 0, 2);
    this.scriptNode.onaudioprocess = this.onaudioprocess.bind(this);
    this.scriptNode.connect(this.audioCtx.destination);
  }

  stop() {
    if (this.scriptNode) {
      this.scriptNode.disconnect(this.audioCtx.destination);
      this.scriptNode.onaudioprocess = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }

  writeSample(left, right) {
    if (this.buffer.size() / 2 >= this.opts.bufferSize) {
      console.log(`Buffer overrun`);
    }
    this.buffer.enq(left);
    this.buffer.enq(right);
  }

  onaudioprocess(e) {
    let samples;
    let left = e.outputBuffer.getChannelData(0);
    let right = e.outputBuffer.getChannelData(1);
    let size = left.length;

    // We're going to buffer underrun. Attempt to fill the buffer.
    if (this.buffer.size() < size * 2 && this.opts.onBufferUnderrun) {
      this.opts.onBufferUnderrun(this.buffer.size(), size * 2);
    }

    try {
      samples = this.buffer.deqN(size * 2);
    } catch (e) {
      // onBufferUnderrun failed to fill the buffer, so handle a real buffer
      // underrun

      // ignore empty buffers... assume audio has just stopped
      let bufferSize = this.buffer.size() / 2;
      if (bufferSize > 0) {
        console.log(`Buffer underrun (needed ${size}, got ${bufferSize})`);
      }
      for (let j = 0; j < size; j++) {
        left[j] = 0;
        right[j] = 0;
      }
      return;
    }
    for (let i = 0; i < size; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
  }
}

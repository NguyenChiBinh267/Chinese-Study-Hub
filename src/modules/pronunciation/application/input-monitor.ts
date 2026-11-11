export type InputLevel = { rms: number; peak: number };
// Level meter only: never connect the microphone to the speakers.
export function monitorInput(
  stream: MediaStream,
  publish: (level: InputLevel) => void,
) {
  if (typeof AudioContext === "undefined") return () => {};
  const context = new AudioContext();
  let source: MediaStreamAudioSourceNode | null = null,
    analyser: AnalyserNode;
  try {
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
  } catch {
    source?.disconnect();
    void context.close().catch(() => {});
    return () => {};
  }
  const samples = new Float32Array(analyser.fftSize);
  let frame = 0,
    stopped = false,
    last = 0;
  const update = (time: number) => {
    if (stopped) return;
    if (time - last >= 100) {
      last = time;
      analyser.getFloatTimeDomainData(samples);
      let peak = 0,
        square = 0;
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
        square += sample * sample;
      }
      publish({ peak, rms: Math.sqrt(square / samples.length) });
    }
    frame = requestAnimationFrame(update);
  };
  void context.resume().catch(() => {});
  frame = requestAnimationFrame(update);
  return () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    source?.disconnect();
    analyser.disconnect();
    void context.close().catch(() => {});
  };
}

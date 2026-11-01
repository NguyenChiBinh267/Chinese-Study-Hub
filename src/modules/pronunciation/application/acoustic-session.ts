import { analyzeRecording, type AnalysisJob } from "./analyze-recording";
import { emptyAnalysis, type AcousticResult } from "../domain/acoustic-types";
export type AcousticView = {
  result: AcousticResult;
  previous: AcousticResult | null;
  single: boolean;
  noiseReduction: boolean;
};
// Ephemeral tab state, with generation isolation for late decoder/worker results.
export class AcousticSession {
  private state: AcousticView;
  private listeners = new Set<() => void>();
  private blob: Blob | null = null;
  private job: AnalysisJob | null = null;
  private generation = 0;
  constructor(
    private target: string,
    private analyze = analyzeRecording,
  ) {
    this.state = {
      result: emptyAnalysis(target),
      previous: null,
      single: false,
      noiseReduction: false,
    };
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(value: AcousticView) {
    this.state = value;
    for (const fn of this.listeners) fn();
  }
  cancel = () => {
    this.generation++;
    this.job?.cancel();
    this.job = null;
    this.publish({
      ...this.state,
      result: emptyAnalysis(this.target, "NOT_ANALYZED", "CANCELLED"),
    });
  };
  setBlob(blob: Blob | null) {
    if (blob === this.blob) return;
    const old = this.state.result;
    this.cancel();
    this.blob = blob;
    if (old.frames.length) this.publish({ ...this.state, previous: old });
  }
  setSingle = (value: boolean) => {
    this.cancel();
    this.publish({ ...this.state, single: value });
  };
  setNoiseReduction = (value: boolean) => {
    this.cancel();
    this.publish({ ...this.state, noiseReduction: value, previous: null });
  };
  forgetPrevious = () => this.publish({ ...this.state, previous: null });
  clear = () => {
    this.cancel();
    this.blob = null;
    this.publish({
      result: emptyAnalysis(this.target),
      previous: null,
      single: false,
      noiseReduction: false,
    });
  };
  run = () => {
    if (!this.blob) return;
    this.cancel();
    const generation = this.generation;
    this.publish({
      ...this.state,
      result: emptyAnalysis(this.target, "PROCESSING"),
    });
    const work = this.analyze(
      this.blob,
      this.target,
      this.state.single,
      this.state.noiseReduction,
    );
    this.job = work;
    void work.result.then((result) => {
      if (this.generation === generation) {
        this.job = null;
        this.publish({ ...this.state, result });
      }
    });
  };
  dispose = () => {
    this.clear();
    this.listeners.clear();
  };
}

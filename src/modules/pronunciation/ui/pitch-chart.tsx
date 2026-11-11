import { useId, useState } from "react";
import type { AcousticResult, PitchFrame } from "../domain/acoustic-types";

export function contourPath(
  frames: PitchFrame[],
  x: (v: number) => number,
  y: (v: number) => number,
) {
  let drawing = false,
    path = "";
  for (const f of frames) {
    if (f.relativeSemitones === null) {
      drawing = false;
      continue;
    }
    path += `${drawing ? "L" : "M"}${x(f.timeSeconds).toFixed(2)},${y(f.relativeSemitones).toFixed(2)} `;
    drawing = true;
  }
  return path.trim();
}
export function PitchChart({
  current,
  previous,
}: {
  current: AcousticResult;
  previous: AcousticResult | null;
}) {
  const id = useId(),
    [position, setPosition] = useState(0);
  const duration = Math.max(
    current.durationSeconds,
    previous?.durationSeconds ?? 0,
    0.1,
  );
  const values = [...current.frames, ...(previous?.frames ?? [])].flatMap(
    (f) =>
      f.relativeSemitones === null ? [] : [Math.abs(f.relativeSemitones)],
  );
  const extent = Math.max(4, ...values) + 1;
  const x = (t: number) => 62 + (480 * t) / duration,
    y = (v: number) => 126 - (85 * v) / extent;
  const index = Math.min(position, Math.max(0, current.frames.length - 1)),
    frame = current.frames[index];
  return (
    <figure
      className="pitch-chart"
      data-current-frames={current.frames.length}
      data-previous-frames={previous?.frames.length ?? 0}
    >
      <svg
        viewBox="0 0 580 300"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>
          Cao độ ước lượng theo thời gian của bản thu
        </title>
        <desc id={`${id}-desc`}>
          Trục ngang là giây, trục dọc là cao độ tương đối quanh mức giữa của
          từng bản thu. Nét liền là lần hiện tại, nét đứt là lần trước nếu có.
          Khoảng trống là khung không đo được; đây không phải điểm phát âm.
        </desc>
        {[-1, 0, 1].map((n) => (
          <g key={n}>
            <line
              x1="62"
              x2="542"
              y1={y(n * extent)}
              y2={y(n * extent)}
              stroke="#ccd6c8"
            />
            <text x="54" y={y(n * extent) + 5} textAnchor="end">
              {(n * extent).toFixed(0)}
            </text>
          </g>
        ))}
        <path d="M62 36V218H548" fill="none" stroke="#53634e" />
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={x(f * duration)} y="245" textAnchor="middle">
            {(f * duration).toFixed(1)} s
          </text>
        ))}
        <text x="62" y="27">
          Cao độ tương đối (bán âm)
        </text>
        <text x="300" y="287" textAnchor="middle">
          Thời gian thực của bản thu
        </text>
        {previous && (
          <path
            data-pitch="previous"
            d={contourPath(previous.frames, x, y)}
            fill="none"
            stroke="#815725"
            strokeWidth="2.5"
            strokeDasharray="7 5"
          />
        )}
        <path
          data-pitch="current"
          d={contourPath(current.frames, x, y)}
          fill="none"
          stroke="#245743"
          strokeWidth="3"
        />
        {frame?.relativeSemitones !== null &&
          frame?.relativeSemitones !== undefined && (
            <circle
              cx={x(frame.timeSeconds)}
              cy={y(frame.relativeSemitones)}
              r="4"
              fill="#245743"
            />
          )}
      </svg>
      <figcaption>
        Nét liền: lần này. {previous ? "Nét đứt: lần trước. " : ""}Đây là số đo
        ước lượng từ bản thu, không phải đường minh họa hay giọng mẫu.
      </figcaption>
      {frame && (
        <>
          <label htmlFor={`${id}-time`}>Xem từng mốc đo</label>
          <input
            id={`${id}-time`}
            type="range"
            min="0"
            max={Math.max(0, current.frames.length - 1)}
            value={index}
            onChange={(e) => setPosition(Number(e.target.value))}
          />
          <p className="pitch-readout" aria-live="polite">
            {frame.timeSeconds.toFixed(2)} giây ·{" "}
            {frame.f0Hz === null
              ? "Không có cao độ đủ tin cậy tại mốc này"
              : `${frame.f0Hz.toFixed(1)} Hz · ${frame.relativeSemitones!.toFixed(1)} bán âm so với mức giữa bản này`}
          </p>
        </>
      )}
      <p className="field-hint">
        Mỗi lần thu lấy mức giữa riêng làm mốc 0; cùng trục thời gian, không kéo
        giãn hoặc ghép đường. Khoảng trống không được nối. Hai lần chưa phải
        bằng chứng tiến bộ hay phát âm đúng.
      </p>
    </figure>
  );
}

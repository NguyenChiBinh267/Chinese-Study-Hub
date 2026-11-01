"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeading } from "@/components/ui";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { localRequest } from "@/modules/content/ui/api";
import { weekdays, validatePreferences } from "../domain/preview-plan";
import {
  studyPreviewCommand,
  type StudyPreferenceCommand,
} from "../domain/study-commands";
import type { SavedStudySettings } from "../domain/study-types";
import type { WeeklyPlan } from "../domain/weekly-plan";
import { WeeklyPlanView } from "./study-panel";
type Draft = Pick<StudyPreferenceCommand, "preferences" | "planning">;
export function StudySchedule() {
  const local = useLocal(),
    router = useRouter();
  const [saved, setSaved] = useState<SavedStudySettings | null>(null),
    [draft, setDraft] = useState<Draft | null>(null),
    [plan, setPlan] = useState<WeeklyPlan | null>(null),
    [errors, setErrors] = useState<string[]>([]),
    [loadError, setLoadError] = useState(""),
    [previewError, setPreviewError] = useState(""),
    [saving, setSaving] = useState(false),
    [acceptLimited, setAcceptLimited] = useState(false),
    [retry, setRetry] = useState(0);
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    void localRequest<SavedStudySettings>("/study/settings")
      .then((value) => {
        if (alive) {
          const selected = new URLSearchParams(window.location.search).get(
            "level",
          );
          setSaved(value);
          setDraft({
            preferences: value.preferences,
            planning: {
              ...value.planning,
              ...(selected === "zero" || selected === "some"
                ? { startingLevel: selected }
                : {}),
            },
          });
          setLoadError("");
        }
      })
      .catch((e) => {
        if (alive)
          setLoadError(
            e instanceof Error ? e.message : "Chưa tải được cấu hình.",
          );
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  useEffect(() => {
    if (!draft) return;
    const parsed = studyPreviewCommand.safeParse(draft);
    if (!parsed.success) return;
    let alive = true;
    const timer = setTimeout(() => {
      void localRequest<WeeklyPlan>("/study/preview", parsed.data)
        .then((value) => {
          if (alive) {
            setPlan(value);
            setPreviewError("");
          }
        })
        .catch((e) => {
          if (alive)
            setPreviewError(
              e instanceof Error ? e.message : "Chưa tính được lịch.",
            );
        });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [draft]);
  function update(patch: Partial<Draft>) {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
    setAcceptLimited(false);
    setErrors([]);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !saved) return;
    const issues = validatePreferences(draft.preferences);
    if (!studyPreviewCommand.safeParse(draft).success)
      issues.push("Kiểm tra giới hạn từng ngày, độ dài buổi và múi giờ.");
    const capacity = draft.planning.dayCaps.reduce((a, b) => a + b, 0);
    if (
      !draft.planning.paused &&
      draft.preferences.weeklyHours * 60 > capacity &&
      !acceptLimited
    )
      issues.push(
        "Lịch rảnh chưa đủ quỹ giờ. Chọn chấp nhận lịch ít giờ hơn hoặc chỉnh lại lựa chọn.",
      );
    if (issues.length) {
      setErrors(issues);
      requestAnimationFrame(() => errorBox.current?.focus());
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      await local.write(
        "preferences",
        { ...draft, expectedVersion: saved.expectedVersion, acceptLimited },
        "PATCH",
      );
      router.push("/today");
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Chưa xác nhận lưu lịch.",
      ]);
    } finally {
      setSaving(false);
    }
  }
  if (!draft || !saved)
    return (
      <section className="panel">
        <h1>Thiết lập lịch học</h1>
        {loadError ? (
          <>
            <p role="alert">{loadError}</p>
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              Tải lại lịch
            </button>
          </>
        ) : (
          <p role="status">Đang đọc cấu hình PostgreSQL…</p>
        )}
      </section>
    );
  const p = draft.preferences,
    extra = draft.planning,
    capacity = extra.dayCaps.reduce((a, b) => a + b, 0),
    gap = Math.max(0, p.weeklyHours * 60 - capacity),
    valid = studyPreviewCommand.safeParse(draft).success;
  function preferences(patch: Partial<typeof p>) {
    update({ preferences: { ...p, ...patch } });
  }
  return (
    <>
      <PageHeading
        title={
          saved.configured
            ? "Điều chỉnh lịch học"
            : "Dành một khoảng nhỏ để học."
        }
        eyebrow="LỊCH HỌC CÓ LƯU"
        description="Quỹ giờ là giới hạn dự định, không phải số phút phải học cho đủ. Lịch ưu tiên ôn đến hạn và không dồn buổi đã lỡ."
      />
      <form className="schedule-grid" onSubmit={submit} noValidate>
        <section className="panel form-panel">
          {!!errors.length && (
            <div
              ref={errorBox}
              className="error-summary"
              id="schedule-errors"
              role="alert"
              tabIndex={-1}
            >
              <strong>Chưa xác nhận thay đổi</strong>
              <ul>
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() => {
                  setErrors([]);
                  setRetry((n) => n + 1);
                }}
              >
                Đọc lại cấu hình đã lưu
              </button>
            </div>
          )}
          <fieldset disabled={saving}>
            <legend>Bạn muốn dành bao nhiêu giờ mỗi tuần?</legend>
            <div className="preset-grid">
              {[3, 6, 9, 12].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  className={`preset ${p.weeklyHours === hours ? "selected" : ""}`}
                  aria-label={`${hours} giờ / tuần`}
                  aria-pressed={p.weeklyHours === hours}
                  onClick={() => preferences({ weeklyHours: hours })}
                >
                  <strong>{hours}</strong>
                  <span>giờ / tuần</span>
                </button>
              ))}
            </div>
            <label className="inline-field" htmlFor="hours">
              Hoặc nhập số giờ
              <input
                id="hours"
                type="number"
                min="0.5"
                max="21"
                step="0.5"
                value={Number.isFinite(p.weeklyHours) ? p.weeklyHours : ""}
                onChange={(e) =>
                  preferences({
                    weeklyHours: e.target.value ? Number(e.target.value) : NaN,
                  })
                }
              />
            </label>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>Những ngày bạn có thể học</legend>
            <div className="day-picker">
              {weekdays.map((day, index) => (
                <label
                  key={day}
                  className={p.days.includes(index) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={p.days.includes(index)}
                    onChange={() => {
                      const days = p.days.includes(index)
                        ? p.days.filter((d) => d !== index)
                        : [...p.days, index].sort();
                      update({
                        preferences: { ...p, days },
                        planning: {
                          ...extra,
                          dayCaps: extra.dayCaps.map((cap, i) =>
                            i === index
                              ? days.includes(index)
                                ? p.dailyCap
                                : 0
                              : cap,
                          ),
                        },
                      });
                    }}
                  />
                  <span aria-hidden="true">
                    {index === 6 ? "CN" : `T${index + 2}`}
                  </span>
                  <span className="sr-only">{day}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>Giới hạn ngày và buổi học</legend>
            <div className="two-fields">
              <label htmlFor="cap">
                Tối đa mỗi ngày
                <input
                  id="cap"
                  type="number"
                  min="10"
                  max="180"
                  value={Number.isFinite(p.dailyCap) ? p.dailyCap : ""}
                  onChange={(e) => {
                    const cap = e.target.value ? Number(e.target.value) : NaN;
                    update({
                      preferences: { ...p, dailyCap: cap },
                      planning: {
                        ...extra,
                        dayCaps: extra.dayCaps.map((_, i) =>
                          p.days.includes(i) ? cap : 0,
                        ),
                      },
                    });
                  }}
                />
              </label>
              <label htmlFor="session">
                Mỗi buổi học
                <select
                  id="session"
                  value={p.sessionMinutes}
                  onChange={(e) =>
                    preferences({ sessionMinutes: Number(e.target.value) })
                  }
                >
                  {[10, 15, 20, 25].map((n) => (
                    <option key={n} value={n}>
                      {n} phút
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details className="per-day-caps">
              <summary>Điều chỉnh giới hạn từng ngày</summary>
              {weekdays.map((day, i) => (
                <label key={day} htmlFor={`day-cap-${i}`}>
                  Giới hạn {day}
                  <input
                    id={`day-cap-${i}`}
                    type="number"
                    min="0"
                    max="180"
                    disabled={!p.days.includes(i)}
                    value={
                      Number.isFinite(extra.dayCaps[i]) ? extra.dayCaps[i] : ""
                    }
                    onChange={(e) => {
                      const cap = e.target.value ? Number(e.target.value) : NaN;
                      update({
                        planning: {
                          ...extra,
                          dayCaps: extra.dayCaps.map((v, n) =>
                            n === i ? cap : v,
                          ),
                        },
                      });
                    }}
                  />
                </label>
              ))}
            </details>
            <div className="two-fields">
              <label htmlFor="max-session">
                Trần một buổi
                <select
                  id="max-session"
                  value={extra.maxSessionMinutes}
                  onChange={(e) =>
                    update({
                      planning: {
                        ...extra,
                        maxSessionMinutes: Number(e.target.value),
                      },
                    })
                  }
                >
                  {[10, 15, 20, 25, 30, 45].map((n) => (
                    <option key={n} value={n}>
                      {n} phút
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="timezone">
                Múi giờ
                <select
                  id="timezone"
                  value={extra.timezone}
                  onChange={(e) =>
                    update({ planning: { ...extra, timezone: e.target.value } })
                  }
                >
                  {[
                    ...new Set([
                      extra.timezone,
                      "Asia/Saigon",
                      "Asia/Shanghai",
                      "UTC",
                      "Europe/London",
                      "America/New_York",
                    ]),
                  ].map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="study-pause">
              <input
                type="checkbox"
                checked={extra.paused}
                onChange={(e) =>
                  update({ planning: { ...extra, paused: e.target.checked } })
                }
              />
              Tạm dừng lịch học
            </label>
            <p className="field-hint">
              Khi tạm dừng, quỹ giờ hoạt động là 0. Giữ cấu hình để tiếp tục,
              không xóa lịch sử hoặc nợ ôn.
            </p>
          </fieldset>
        </section>
        <aside className="panel plan-preview" aria-label="Xem trước lịch học">
          <h2>Trước khi lưu</h2>
          <p className="plan-total">
            <strong>
              {Number.isFinite(capacity) && Number.isFinite(p.weeklyHours)
                ? extra.paused
                  ? 0
                  : Math.min(p.weeklyHours * 60, capacity)
                : 0}
              <span> phút khả thi cả tuần</span>
            </strong>
          </p>
          <p>
            {Number.isFinite(p.weeklyHours) ? p.weeklyHours * 60 : 0} phút mong
            muốn · sức chứa {Number.isFinite(capacity) ? capacity : 0} phút.
            Ngày đã qua không được xếp bù vượt cap.
          </p>
          {gap > 0 && !extra.paused && (
            <div className="capacity-warning" role="status">
              <strong>Còn {gap} phút chưa xếp được</strong>
              <label>
                <input
                  type="checkbox"
                  checked={acceptLimited}
                  onChange={(e) => setAcceptLimited(e.target.checked)}
                />
                Tôi chấp nhận lịch tối đa {capacity} phút.
              </label>
            </div>
          )}
          {previewError && (
            <p role="alert">
              Chưa xác nhận preview: {previewError}
              <button
                type="button"
                className="text-link"
                onClick={() => setDraft({ ...draft })}
              >
                Thử tính lịch lại
              </button>
            </p>
          )}
          {!valid && (
            <p role="status">Nhập lựa chọn hợp lệ để tính lịch thực tế.</p>
          )}
          <button
            type="submit"
            className="button primary full"
            disabled={saving || !!previewError}
          >
            {saving ? "Đang chờ server xác nhận…" : "Lưu lịch vào PostgreSQL"}
          </button>
          <p className="setup-footnote">
            {saved.configured
              ? `Đã đọc lịch PostgreSQL phiên bản ${saved.expectedVersion}.`
              : "Chưa lưu lịch vào database."}
          </p>
          <p className="field-hint">
            Bài DRAFT chỉ được luyện tùy chọn, không được coi là mastery hoặc mở
            khóa thật.
          </p>
        </aside>
      </form>
      {valid && plan && <WeeklyPlanView plan={plan} />}
    </>
  );
}

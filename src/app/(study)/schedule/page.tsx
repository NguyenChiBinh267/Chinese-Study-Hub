"use client";

import { StudySchedule } from "@/modules/planning/ui/study-schedule";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Clock3, Info } from "lucide-react";
import { DemoNotice, PageHeading } from "@/components/ui";
import {
  previewPlan,
  validatePreferences,
  weekdays,
} from "@/modules/planning/domain/preview-plan";
import { usePreview } from "@/modules/preview/ui/preview-provider";
import { useLocal, LocalStatus } from "@/modules/learning/ui/local-provider";
import { defaultPreferences } from "@/modules/planning/domain/preview-plan";

export default function Schedule() {
  const local = useLocal();
  if (local.mode === "local" && local.status !== "ready")
    return <LocalStatus />;
  if (local.mode === "local") return <StudySchedule />;
  return <ScheduleForm key="demo" />;
}
function ScheduleForm() {
  const state = usePreview();
  const local = useLocal(),
    isLocal = local.mode === "local";
  const preferences = isLocal
    ? (local.data?.settings?.preferences ?? defaultPreferences)
    : state.preferences;
  const configured = isLocal ? Boolean(local.data?.settings) : state.configured;
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    ...preferences,
    days: [...preferences.days],
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [acceptLimited, setAcceptLimited] = useState(false);
  const router = useRouter();
  const plan = previewPlan(draft);
  function update(patch: Partial<typeof draft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setAcceptLimited(false);
    setErrors([]);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problems = validatePreferences(draft);
    if (plan && plan.shortfall > 0 && !acceptLimited)
      problems.push(
        "Lịch rảnh chưa đủ quỹ giờ. Chọn chấp nhận lịch ít giờ hơn hoặc chỉnh lại lựa chọn.",
      );
    if (problems.length) {
      setErrors(problems);
      requestAnimationFrame(() =>
        document.getElementById("schedule-errors")?.focus(),
      );
      return;
    }
    if (isLocal) {
      setSaving(true);
      try {
        await local.write(
          "preferences",
          {
            preferences: draft,
            expectedVersion: local.data?.settings?.version ?? 0,
            acceptLimited,
          },
          "PATCH",
        );
        router.push("/today");
      } catch (e) {
        setErrors([e instanceof Error ? e.message : "Chưa xác nhận lưu lịch."]);
      } finally {
        setSaving(false);
      }
    } else {
      state.applyPreferences(draft);
      router.push("/today");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="NHỊP HỌC CỦA BẠN"
        title={
          configured ? "Điều chỉnh lịch học" : "Dành một khoảng nhỏ để học."
        }
        description="Một lịch học vừa sức sẽ dễ duy trì hơn. Hãy chọn nhịp phù hợp với bạn."
      />
      <form onSubmit={submit} noValidate className="schedule-grid">
        <section className="panel form-panel">
          {errors.length > 0 && (
            <div
              className="error-summary"
              id="schedule-errors"
              role="alert"
              tabIndex={-1}
            >
              <strong>Kiểm tra lại lịch học</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <fieldset disabled={saving}>
            <legend>
              <span className="number">01</span>Bạn muốn dành bao nhiêu giờ mỗi
              tuần?
            </legend>
            <div className="preset-grid">
              {[3, 6, 9, 12].map((hours) => (
                <button
                  type="button"
                  key={hours}
                  aria-label={`${hours} giờ / tuần`}
                  aria-pressed={draft.weeklyHours === hours}
                  className={`preset ${draft.weeklyHours === hours ? "selected" : ""}`}
                  onClick={() => update({ weeklyHours: hours })}
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
                value={Number.isNaN(draft.weeklyHours) ? "" : draft.weeklyHours}
                onChange={(event) =>
                  update({
                    weeklyHours:
                      event.target.value === ""
                        ? NaN
                        : Number(event.target.value),
                  })
                }
              />
            </label>
          </fieldset>
          <fieldset disabled={saving}>
            <legend>
              <span className="number">02</span>Những ngày bạn có thể học
            </legend>
            <div className="day-picker">
              {weekdays.map((day, index) => (
                <label
                  key={day}
                  className={draft.days.includes(index) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={draft.days.includes(index)}
                    onChange={() =>
                      update({
                        days: draft.days.includes(index)
                          ? draft.days.filter((value) => value !== index)
                          : [...draft.days, index],
                      })
                    }
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
            <legend>
              <span className="number">03</span>Thời lượng vừa sức với bạn
            </legend>
            <div className="two-fields">
              <label htmlFor="cap">
                Tối đa mỗi ngày
                <span className="input-unit">
                  <input
                    id="cap"
                    type="number"
                    min="10"
                    max="180"
                    value={Number.isNaN(draft.dailyCap) ? "" : draft.dailyCap}
                    onChange={(event) =>
                      update({
                        dailyCap:
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                      })
                    }
                  />
                  <span>phút</span>
                </span>
              </label>
              <label htmlFor="session">
                Mỗi buổi học
                <select
                  id="session"
                  value={draft.sessionMinutes}
                  onChange={(event) =>
                    update({ sessionMinutes: Number(event.target.value) })
                  }
                >
                  {[10, 15, 20, 25].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} phút
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="field-hint">
              Buổi ngắn được chia trong giới hạn ngày. Bạn không cần chọn giờ
              bắt đầu cố định.
            </p>
          </fieldset>
        </section>
        <aside className="panel plan-preview" aria-label="Xem trước lịch học">
          <div className="section-title">
            <h2>
              <CalendarDays size={20} aria-hidden="true" /> Tuần học dự kiến
            </h2>
            <span className="badge neutral">
              {isLocal ? "PREVIEW TỪ LỊCH LOCAL" : "DEMO"}
            </span>
          </div>
          {plan ? (
            <>
              <div className="plan-total">
                <strong>
                  {plan.active}
                  <span> phút học</span>
                </strong>
                <p>
                  + {plan.buffer} phút dự phòng / {plan.target} phút mong muốn
                </p>
              </div>
              <div className="week-preview">
                {plan.days.map((day) => (
                  <div key={day.day} className={day.minutes ? "" : "rest"}>
                    <span>{day.label}</span>
                    <div className="day-bar">
                      <i
                        style={{
                          width: `${(day.minutes / draft.dailyCap) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{day.minutes ? `${day.minutes}′` : "Nghỉ"}</strong>
                  </div>
                ))}
              </div>
              <p className="field-hint">
                <Clock3 size={14} aria-hidden="true" /> Mỗi buổi tối đa{" "}
                {draft.sessionMinutes} phút; buổi cuối có thể ngắn hơn. Đây là
                phép chia thời gian mẫu, chưa dùng dữ liệu học.
              </p>
              {plan.shortfall > 0 && (
                <div className="capacity-warning" role="status">
                  <strong>Còn {plan.shortfall} phút chưa xếp được</strong>
                  <p>
                    Lịch rảnh chứa tối đa {plan.capacity} phút. Thêm ngày, tăng
                    giới hạn hoặc chọn giữ lịch ít giờ hơn.
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={acceptLimited}
                      onChange={(event) =>
                        setAcceptLimited(event.target.checked)
                      }
                    />
                    Tôi chấp nhận lịch tối đa {plan.feasible} phút.
                  </label>
                </div>
              )}
              <button
                className="button primary full"
                type="submit"
                disabled={saving}
              >
                {isLocal
                  ? saving
                    ? "Đang chờ server xác nhận…"
                    : "Lưu lịch vào PostgreSQL"
                  : state.configured
                    ? "Áp dụng thay đổi demo"
                    : "Áp dụng lịch demo"}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="preview-invalid">
              <Info size={26} aria-hidden="true" />
              <p>Chọn ngày rảnh và nhập thời lượng hợp lệ để xem lịch.</p>
              <button className="button secondary" type="submit">
                Kiểm tra lựa chọn
              </button>
            </div>
          )}
          <p className="setup-footnote" role="status">
            {isLocal
              ? saving
                ? "Chưa xác nhận lưu. Đang chờ database."
                : local.data?.settings
                  ? `Đã đọc lịch PostgreSQL phiên bản ${local.data.settings.version}.`
                  : "Chưa lưu lịch vào database."
              : "Lựa chọn được giữ trong tab này."}
          </p>
        </aside>
      </form>
      <DemoNotice>
        {isLocal
          ? "Cấu hình được lưu thật; phép chia lịch dưới đây vẫn là preview. "
          : ""}
        Lịch mẫu dành 10% thời gian khả thi làm dự phòng. Chưa có planner theo
        FSRS, lịch theo ngày thực hoặc đồng bộ server.
      </DemoNotice>
    </>
  );
}

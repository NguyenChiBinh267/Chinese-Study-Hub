"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PlanBlock, WeeklyPlan } from "../domain/weekly-plan";
import type { StudySnapshot } from "../domain/study-types";
import { weekdays } from "../domain/preview-plan";
import { useStudy } from "./use-study";
import { courseHref, unitHref } from "@/modules/curriculum/ui/courses";
export function studyHref(block: PlanBlock) {
  if (block.kind === "review") return "/review";
  const id = block.target.split("-")[0].toUpperCase();
  return `/learn/draft/${id}?version=${encodeURIComponent(block.target)}`;
}
export function actionLabel(block: PlanBlock) {
  return block.kind === "review"
    ? "Ôn thẻ đến hạn"
    : `${block.kind === "resume" ? "Tiếp tục" : "Luyện"} ${block.target.split("-")[0].toUpperCase()} · draft`;
}
const explanations: Record<string, string> = {
  RELEARNING_FIRST: "Có thẻ đang học lại; ưu tiên ôn trước bài mới.",
  DUE_BEFORE_NEW: "Thẻ FSRS đã đến hạn; ôn trước để không tăng nợ ôn.",
  RESUME_SAVED_CHECKPOINT:
    "Có phiên học chưa hoàn tất. Tiếp tục từ bước đã lưu.",
  OPTIONAL_DRAFT_NOT_UNLOCKED:
    "Bài tiếp theo trong lộ trình luyện draft. Chưa đủ bằng chứng được duyệt để mở khóa thật.",
  ELIGIBLE_LESSON: "Bài phù hợp với điều kiện đã kiểm tra.",
};
export function ActionContent({
  snapshot,
  compact = false,
}: {
  snapshot: StudySnapshot;
  compact?: boolean;
}) {
  const plan = snapshot.plan;
  if (!snapshot.configured || !plan)
    return (
      <>
        <h2>Chọn nhịp học trước khi bắt đầu</h2>
        <p>Lưu quỹ giờ và ngày rảnh để app xếp việc học phù hợp.</p>
        <Link href="/schedule" className="button primary">
          Thiết lập lịch học
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </>
    );
  const action = plan.action;
  if (!action) {
    const paused = snapshot.settings.planning.paused,
      rest = plan.todayCapacityMinutes <= 0;
    return (
      <>
        <h2>
          {paused
            ? "Lịch học đang tạm dừng"
            : plan.remainingMinutes <= 0
              ? "Đã dùng hết quỹ giờ tuần này"
              : rest
                ? "Hôm nay là ngày nghỉ hoặc đã hết thời gian"
                : "Chưa có việc học phù hợp lúc này"}
        </h2>
        <p>
          {paused
            ? "Nợ ôn và lịch sử vẫn được giữ. Bỏ tạm dừng trong lịch học khi bạn sẵn sàng."
            : rest
              ? "Không dồn buổi đã lỡ vào hôm nay. Bạn có thể sửa lịch nếu thực sự có thêm thời gian."
              : "Không thêm bài lặp để lấp đầy giờ. Các bài mới vẫn cần điều kiện và review; hãy xem tiến độ hoặc quay lại khi thẻ đến hạn."}
        </p>
        <Link
          href={paused || rest ? "/schedule" : "/progress"}
          className="button primary"
        >
          {paused || rest ? "Điều chỉnh lịch học" : "Xem tiến độ"}
        </Link>
      </>
    );
  }
  return (
    <>
      <span className="badge green">
        {action.kind === "review"
          ? "ÔN TẬP FSRS"
          : "PRACTICE LOCAL · CHƯA DUYỆT"}
      </span>
      <h2>{actionLabel(action)}</h2>
      {action.courseCode && (
        <p className="course-context">
          <Link href={courseHref(action.courseCode)}>{action.courseTitle}</Link>{" "}
          /{" "}
          <Link href={unitHref(action.courseCode, action.unitSlug!)}>
            {action.unitTitle}
          </Link>
        </p>
      )}
      <p>
        {explanations[action.reason] ?? "Tiếp tục nhiệm vụ trong lịch đã lưu."}
      </p>
      <p className="field-hint">
        Khoảng {action.estimatedMinutes} phút dự kiến · còn{" "}
        {Math.max(0, Math.floor(plan.remainingMinutes))} phút trong quỹ tuần.
      </p>
      <Link
        data-testid="study-primary"
        className="button primary"
        href={studyHref(action)}
      >
        {compact ? "Tiếp tục theo lịch" : actionLabel(action)}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </>
  );
}
export function NextStudyAction() {
  const state = useStudy();
  return (
    <section
      className="panel next-study-action"
      aria-label="Việc học tiếp theo"
    >
      {state.error ? (
        <>
          <p role="alert">Chưa xác nhận việc tiếp theo: {state.error}</p>
          <button className="button secondary" onClick={state.reload}>
            Thử đọc lại lịch
          </button>
        </>
      ) : !state.data ? (
        <p role="status">Đang đọc việc học tiếp theo…</p>
      ) : (
        <ActionContent snapshot={state.data} compact />
      )}
    </section>
  );
}
export function WeeklyPlanView({ plan }: { plan: WeeklyPlan }) {
  const format = (n: number) => Number(n.toFixed(1)).toLocaleString("vi-VN");
  return (
    <section className="panel weekly-plan-view" aria-label="Lịch tuần thực tế">
      <div className="section-title">
        <h2>Lịch tuần của bạn</h2>
        <span className="badge neutral">{plan.weekStart}</span>
      </div>
      <dl className="weekly-metrics">
        <div>
          <dt>Mong muốn</dt>
          <dd>{format(plan.requestedMinutes)} phút</dd>
        </div>
        <div>
          <dt>Khả thi cả tuần</dt>
          <dd>{format(plan.feasibleMinutes)} phút</dd>
        </div>
        <div>
          <dt>Thiếu sức chứa</dt>
          <dd>{format(plan.unscheduledMinutes)} phút</dd>
        </div>
        <div>
          <dt>Đã đo và lưu</dt>
          <dd>{format(plan.actualMinutes)} phút</dd>
        </div>
        <div>
          <dt>Dự phòng còn lại</dt>
          <dd>{format(plan.bufferMinutes)} phút</dd>
        </div>
        <div>
          <dt>Chưa dùng / chưa có bài</dt>
          <dd>{format(plan.unusedMinutes)} phút</dd>
        </div>
      </dl>
      <p>
        {plan.plannedMinutes} phút hoạt động dự kiến còn lại; quỹ tuần còn{" "}
        {format(plan.remainingMinutes)} phút. Không coi thời lượng dự kiến là
        thời gian đã học.
      </p>
      {plan.reviewDebtCards > 0 && (
        <p role="status" className="capacity-warning">
          Quá tải ôn: còn {plan.reviewDebtCards} thẻ đến hạn chưa xếp được. Dừng
          thêm bài mới; nợ ôn không bị xóa.
        </p>
      )}
      {plan.reasons.includes("BUDGET_BELOW_SPENT") && (
        <p role="status">
          Quỹ mới thấp hơn thời gian đã học. Giữ nguyên lịch sử, còn lại 0 phút.
        </p>
      )}
      <ol className="study-week-list">
        {Array.from({ length: 7 }, (_, i) => {
          const date = new Date(`${plan.weekStart}T12:00:00Z`);
          date.setUTCDate(date.getUTCDate() + i);
          const key = date.toISOString().slice(0, 10),
            blocks = [...plan.frozen, ...plan.blocks].filter(
              (b) => b.localDate === key,
            );
          return (
            <li key={key} className={key === plan.today ? "is-today" : ""}>
              <strong>
                {weekdays[i]} <small>{key.slice(5)}</small>
              </strong>
              {blocks.length ? (
                <ul>
                  {blocks.map((b) => (
                    <li key={b.id}>
                      <span>
                        {actionLabel(b)}
                        {b.courseTitle && (
                          <small className="muted">
                            {" "}
                            · {b.courseTitle} / {b.unitTitle}
                          </small>
                        )}
                      </span>
                      <span>
                        {b.estimatedMinutes}′ ·{" "}
                        {b.status === "completed"
                          ? "đã hoàn tất luyện"
                          : b.status === "in_progress"
                            ? "đang học"
                            : b.status === "tentative"
                              ? "practice tùy chọn"
                              : "dự kiến"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">
                  {key < plan.today
                    ? "Không chuyển nợ phút từ ngày đã qua"
                    : "Nghỉ / chưa có nhiệm vụ phù hợp"}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <details className="source-details">
        <summary>Cách xếp lịch và giới hạn số liệu</summary>
        <p>
          Ưu tiên thẻ học lại/đến hạn; giữ bước đang học; phần chưa làm được xếp
          lại trong ngày rảnh và giới hạn ngày/buổi. Không đổi hạn FSRS hoặc
          cộng bù giờ đã lỡ.
        </p>
        <p>
          Chi phí ôn là ước tính {plan.costModel.secondsPerCard.toFixed(0)}{" "}
          giây/thẻ (
          {plan.costModel.source === "fallback_30_seconds"
            ? "chưa đủ dữ liệu, dùng mặc định"
            : "ước tính từ thời gian lật–trả lời 14 ngày"}
          ); không phải thời gian học đã xác minh.
        </p>
        <p>
          Thời gian đã học chỉ từ interval foreground được server ACK, có giới
          hạn idle60giây. Không tạo mastery từ số phút. {plan.forecast.message}
        </p>
        <p>
          Planner {plan.plannerVersion} · asOf{" "}
          {new Date(plan.asOf).toLocaleString("vi-VN", {
            timeZone: plan.timezone,
          })}{" "}
          · {plan.timezone}. Lý do:{" "}
          {plan.reasons.join(", ") || "WITHIN_CAPACITY"}.
        </p>
      </details>
    </section>
  );
}

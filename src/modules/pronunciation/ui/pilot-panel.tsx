"use client";
import { useState, useSyncExternalStore } from "react";
import {
  hardwareStatus,
  pilotReport,
  type PilotMeta,
  type PilotSession,
} from "../domain/pilot";
export function PilotPanel({
  session,
  selected,
  select,
}: {
  session: PilotSession;
  selected: string;
  select: (target: string) => void;
}) {
  const state = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );
  const [meta, setMeta] = useState<PilotMeta>(state.meta),
    [error, setError] = useState("");
  const [review, setReview] = useState("LATEST");
  const rows = state.attempts.filter((a) => a.target === selected);
  const shownReview = rows.some((row) => String(row.id) === review)
    ? review
    : "LATEST";
  const current =
    shownReview === "LATEST"
      ? rows.at(-1)
      : rows.find((row) => String(row.id) === shownReview);
  function exportReport() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify(pilotReport(state.meta, state.attempts), null, 2)],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chinese-study-hub-pilot.json";
    link.click();
    queueMicrotask(() => URL.revokeObjectURL(url));
  }
  return (
    <section className="panel pilot-panel" aria-label="Pilot micro thật">
      <h2>Thử micro thật · 4 thanh, tối đa 3 lượt mỗi thanh</h2>
      <p>
        Chỉ kiểm tra công cụ, chưa chấm phát âm. Dữ liệu form ở trong tab; tải
        lại sẽ mất. Đổi thiết bị/nguồn và lưu thiết lập sẽ xóa các lượt trong
        form, tránh gán nhầm bằng chứng.
      </p>
      <ol>
        <li>
          Dùng Chrome/Edge trên Windows, chọn đúng micro trong quyền của trình
          duyệt.
        </li>
        <li>
          Ở phòng yên tĩnh: bấm ghi, im lặng nửa giây rồi đọc một âm tiết ở mức
          thoải mái; xem mức tín hiệu.
        </li>
        <li>
          Dừng, nghe hết bản gốc, đánh dấu một âm tiết rồi phân tích. Xem hướng
          dẫn có sẵn, ghi lại để so.
        </li>
        <li>
          Điền kết quả thật sau từng lượt; thử thanh 1–4, mỗi thanh tối đa ba
          lượt trong lần mở pilot này.
        </li>
      </ol>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!meta.browser.trim() || !meta.microphone.trim()) {
            setError("Điền trình duyệt và micro đang dùng.");
            return;
          }
          session.setMeta(meta);
          setError("");
        }}
      >
        <div className="pilot-fields">
          <label>
            Thiết bị
            <select
              value={meta.platform}
              onChange={(e) =>
                setMeta({
                  ...meta,
                  platform: e.target.value as PilotMeta["platform"],
                })
              }
            >
              <option value="UNKNOWN">Chưa xác nhận</option>
              <option value="WINDOWS">Windows</option>
              <option value="ANDROID">Android</option>
            </select>
          </label>
          <label>
            Trình duyệt / phiên bản
            <input
              maxLength={120}
              value={meta.browser}
              onChange={(e) => setMeta({ ...meta, browser: e.target.value })}
              placeholder="Ví dụ: Chrome trên Windows"
            />
          </label>
          <label>
            Micro đang dùng
            <input
              maxLength={120}
              value={meta.microphone}
              onChange={(e) => setMeta({ ...meta, microphone: e.target.value })}
              placeholder="Micro laptop / tai nghe…"
            />
          </label>
          <label>
            Nguồn âm thanh
            <select
              value={meta.source}
              onChange={(e) =>
                setMeta({
                  ...meta,
                  source: e.target.value as PilotMeta["source"],
                })
              }
            >
              <option value="UNCONFIRMED">Chưa xác nhận</option>
              <option value="PHYSICAL_OWNER_DECLARED">
                Tôi đang nói vào micro vật lý thật
              </option>
              <option value="SYNTHETIC">
                Tín hiệu tổng hợp / kiểm thử tự động
              </option>
            </select>
          </label>
        </div>
        <button className="button secondary" type="submit">
          Lưu thiết lập pilot trong tab
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      <div className="pron-actions">
        {[1, 2, 3, 4].map((tone) => (
          <button
            key={tone}
            className="button secondary"
            aria-pressed={selected === `pron-tone-${tone}-v1`}
            onClick={() => select(`pron-tone-${tone}-v1`)}
          >
            Thanh {tone} · {session.count(`pron-tone-${tone}-v1`)}/3
          </button>
        ))}
      </div>
      <p>
        Windows physical microphone:{" "}
        {hardwareStatus(state.meta, state.attempts, "WINDOWS")}. Android
        physical microphone:{" "}
        {hardwareStatus(state.meta, state.attempts, "ANDROID")}. Phonetic
        assessment accuracy: UNVERIFIED.
      </p>
      <p className="field-hint">
        Nguồn tổng hợp không tạo hardware PASS. PASS ở đây là chủ máy tự báo sau
        thao tác thật, chưa phải đánh giá độ chính xác chung của thuật toán.
        Không có audio trong báo cáo.
      </p>
      {current && (
        <fieldset className="pilot-observation">
          <legend>Kết quả chủ máy thấy · lượt {current.number}</legend>
          <label>
            Lượt cần ghi nhận
            <select
              value={shownReview}
              onChange={(event) => setReview(event.target.value)}
            >
              <option value="LATEST">Lượt mới nhất</option>
              {rows.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  Lượt {row.number}
                </option>
              ))}
            </select>
          </label>
          <p>
            Quyền: {current.permission}. Ghi âm: {current.recording}. Phân tích:{" "}
            {current.measurement?.status ?? "chưa có"} /{" "}
            {current.measurement?.reason ?? "chưa có"}. Phát hết bản gốc:{" "}
            {current.playedToEnd ? "có" : "chưa"}.
          </p>
          <div className="pilot-fields">
            <label>
              Nghe lại có rõ giọng không?
              <select
                value={current.clarity}
                onChange={(e) =>
                  session.update(current.id, {
                    clarity: e.target.value as typeof current.clarity,
                  })
                }
              >
                <option value="UNKNOWN">Chưa đánh giá</option>
                <option value="CLEAR">Rõ</option>
                <option value="UNCLEAR">Nhỏ / rè / không rõ</option>
              </select>
            </label>
            <label>
              Đồ thị khớp hướng giọng bạn nghe?
              <select
                value={current.graph}
                onChange={(e) =>
                  session.update(current.id, {
                    graph: e.target.value as typeof current.graph,
                  })
                }
              >
                <option value="UNKNOWN">Chưa biết / không đủ dữ liệu</option>
                <option value="MATCHES">Có vẻ khớp</option>
                <option value="SUSPECT">Nghi ngờ / không khớp</option>
              </select>
            </label>
            <label>
              Nhận xét có dễ hiểu?
              <select
                value={current.feedback}
                onChange={(e) =>
                  session.update(current.id, {
                    feedback: e.target.value as typeof current.feedback,
                  })
                }
              >
                <option value="UNKNOWN">Chưa đánh giá</option>
                <option value="CLEAR">Dễ hiểu</option>
                <option value="CONFUSING">Khó hiểu / nghi ngờ</option>
              </select>
            </label>
            <label>
              Kết luận lượt thử
              <select
                value={current.outcome}
                onChange={(e) =>
                  session.update(current.id, {
                    outcome: e.target.value as typeof current.outcome,
                  })
                }
              >
                <option value="NOT_TESTED">NOT_TESTED</option>
                <option value="PASS">PASS · tôi đã kiểm tra</option>
                <option value="FAIL">FAIL · có vấn đề</option>
              </select>
            </label>
          </div>
          <label>
            Lỗi runtime/UI hoặc kết quả bạn nghi ngờ
            <textarea
              maxLength={1000}
              value={current.notes}
              onChange={(e) =>
                session.update(current.id, { notes: e.target.value })
              }
            />
          </label>
        </fieldset>
      )}
      <p>
        {state.attempts.length}/12 lượt trong tab. Các lượt trước vẫn nằm trong
        báo cáo JSON.
      </p>
      <button className="button secondary" onClick={exportReport}>
        Tải báo cáo pilot JSON · không có audio
      </button>
    </section>
  );
}

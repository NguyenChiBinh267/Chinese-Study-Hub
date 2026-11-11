"use client";
import { useEffect, useState } from "react";
export function MandarinTts({ text }: { text: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance !== "function"
    )
      return;
    const synth = window.speechSynthesis;
    const update = () => {
      try {
        setVoices(
          synth
            .getVoices()
            .filter((v) => v.localService && /^zh[-_]CN$/i.test(v.lang)),
        );
      } catch {
        setVoices([]);
      }
    };
    const stop = () => synth.cancel();
    const hidden = () => {
      if (document.visibilityState !== "visible") stop();
    };
    update();
    synth.addEventListener("voiceschanged", update);
    for (const event of [
      "pagehide",
      "csh-session-ending",
      "csh-session-expired",
    ])
      window.addEventListener(event, stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      stop();
      synth.removeEventListener("voiceschanged", update);
      for (const event of [
        "pagehide",
        "csh-session-ending",
        "csh-session-expired",
      ])
        window.removeEventListener(event, stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [text]);
  function speak() {
    try {
      const synth = window.speechSynthesis,
        voice = voices[0];
      if (!voice) return;
      synth.cancel();
      // Speak Chinese, not the Pinyin transcription or dialogue speaker labels.
      const utterance = new SpeechSynthesisUtterance(
        text.replace(/[AB]：/g, ""),
      );
      utterance.lang = "zh-CN";
      utterance.voice = voice;
      utterance.rate = 0.85;
      utterance.onerror = () =>
        setMessage(
          "Không phát được giọng tổng hợp. Bạn vẫn có thể đọc và luyện bài chữ.",
        );
      utterance.onend = () =>
        setMessage("Đã kết thúc giọng tổng hợp; độ chuẩn chưa được duyệt.");
      setMessage("Đang đọc bằng giọng tổng hợp chưa duyệt…");
      synth.speak(utterance);
    } catch {
      setMessage("Không phát được giọng tổng hợp. Tiếp tục bằng bài chữ.");
    }
  }
  return (
    <aside className="notice" aria-label="Giọng tổng hợp tùy chọn">
      <p>
        TTS zh-CN · tổng hợp, chưa duyệt. Không phải mẫu người bản ngữ hoặc đánh
        giá nghe/phát âm.
      </p>
      <p>
        Chỉ dùng giọng có sẵn trên thiết bị (localService); không tải audio hay
        gọi API trả phí.
      </p>
      <button
        className="button secondary"
        disabled={!voices.length}
        onClick={speak}
      >
        Nghe TTS tùy chọn
      </button>{" "}
      <button
        className="button secondary"
        disabled={!voices.length}
        onClick={() => window.speechSynthesis.cancel()}
      >
        Dừng TTS
      </button>
      <p role="status">
        {message ||
          (!voices.length
            ? "Chưa có giọng zh-CN trên thiết bị. Tiếp tục đọc chữ; TTS không bắt buộc."
            : "Giọng thiết bị sẵn sàng; chỉ phát khi bạn bấm nghe.")}
      </p>
    </aside>
  );
}

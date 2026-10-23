import { PronunciationCoach } from "@/modules/pronunciation/ui/coach";
import { PageHeading } from "@/components/ui";
export default async function PronunciationPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string | string[]; pilot?: string }>;
}) {
  const { target, pilot } = await searchParams;
  const selected =
    target === undefined
      ? undefined
      : typeof target === "string" && target.length <= 160
        ? target
        : "invalid-target-v1";
  return (
    <div className="page-container">
      <PageHeading
        eyebrow="FOUNDATION · LUYỆN TÙY CHỌN"
        title="Từng âm, từng động tác nhỏ"
        description="Nhìn khẩu hình, thử một động tác, rồi tự nghe lại. Hướng dẫn chưa duyệt không phải nhận xét về giọng của bạn."
      />
      <PronunciationCoach
        initialTarget={
          selected ?? (pilot === "1" ? "pron-tone-1-v1" : undefined)
        }
        pilot={pilot === "1"}
      />
    </div>
  );
}

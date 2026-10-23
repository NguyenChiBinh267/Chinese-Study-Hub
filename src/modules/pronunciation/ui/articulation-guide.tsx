import { useId } from "react";
import type { Illustration } from "../domain/notes";

const placeName: Record<Illustration["place"], string> = {
  LIPS: "Hai môi",
  DENTAL: "Vùng răng trên / gờ lợi",
  PALATAL: "Phần trước lưỡi và vòm cứng",
  POSTALVEOLAR: "Đầu lưỡi phía sau gờ lợi",
  VELAR: "Phần sau lưỡi và vòm mềm",
  FRONT_VOWEL: "Thân lưỡi cao phía trước",
  BACK_VOWEL: "Thân lưỡi cao phía sau",
  NONE: "Không quy định tư thế",
};
const contourName: Record<Illustration["contour"], string> = {
  LEVEL: "cao và đều",
  RISE: "đi lên",
  DIP: "xuống rồi lên khi đọc riêng",
  LOW: "giữ thấp trong cụm",
  FALL: "đi xuống",
  NEUTRAL: "âm nhẹ ngắn, cao độ theo ngữ cảnh",
  SANDHI: "biến điệu 3 + 3 thành 2 + 3",
  NONE: "không vẽ đường thanh",
};
function tonguePath(
  place: Illustration["place"],
  closed: boolean,
  manner: Illustration["manner"],
) {
  const lower = " L270,218 Q200,245 115,207 Q84,190 86,172 Z";
  switch (place) {
    case "DENTAL":
      return (
        (closed
          ? "M87,110 Q110,116 150,156 Q215,173 270,218"
          : manner === "FRICATIVE"
            ? "M90,121 Q120,139 158,165 Q225,180 270,218"
            : "M90,137 Q120,142 158,165 Q225,180 270,218") + lower
      );
    case "PALATAL":
      return (
        (closed
          ? "M88,167 Q105,110 148,83 Q205,115 270,218"
          : manner === "FRICATIVE"
            ? "M88,167 Q108,119 148,99 Q205,126 270,218"
            : "M88,167 Q108,127 148,108 Q205,130 270,218") + lower
      );
    case "POSTALVEOLAR":
      return (
        (closed
          ? "M120,87 Q105,130 145,155 Q220,170 270,218"
          : manner === "APPROXIMANT"
            ? "M121,127 Q108,151 147,168 Q222,180 270,218"
            : manner === "FRICATIVE"
              ? "M121,101 Q108,133 147,162 Q222,180 270,218"
              : "M121,112 Q108,140 147,162 Q222,180 270,218") + lower
      );
    case "VELAR":
      return (
        (closed
          ? "M88,171 Q150,188 220,90 Q243,123 270,218"
          : "M88,171 Q150,190 220,126 Q248,150 270,218") + lower
      );
    case "FRONT_VOWEL":
      return "M88,172 Q109,116 151,101 Q209,124 270,218" + lower;
    case "BACK_VOWEL":
      return "M88,175 Q150,185 222,107 Q251,144 270,218" + lower;
    default:
      return "M88,174 Q132,157 190,171 Q236,183 270,218" + lower;
  }
}
function Tract({ model, closure }: { model: Illustration; closure: boolean }) {
  const uid = useId(),
    lipClosed = model.place === "LIPS" && closure;
  const contacts: Partial<Record<Illustration["place"], [number, number]>> = {
    LIPS: [48, 145],
    DENTAL: [87, 111],
    PALATAL: [148, 85],
    POSTALVEOLAR: [120, 88],
    VELAR: [220, 91],
  };
  const contact = contacts[model.place];
  const desc = `${placeName[model.place]}. ${closure ? "Giai đoạn chặn: chưa có hơi thoát ra ngoài." : model.aspiration === "ASPIRATED" ? "Sau khi thả chỗ chặn: mũi tên dài chỉ hơi bật tương đối mạnh." : "Mũi tên chỉ hơi đi ra, không phải phép đo lưu lượng."} ${model.description} ${model.limitations}`;
  return (
    <svg
      viewBox="0 0 350 275"
      role="img"
      aria-labelledby={`${uid}-title ${uid}-desc`}
    >
      <title id={`${uid}-title`}>
        {`${placeName[model.place]} · ${closure ? "chặn" : "thả / giữ khe"}`}
      </title>
      <desc id={`${uid}-desc`}>{desc}</desc>
      <defs>
        <marker
          id={`${uid}-arrow`}
          markerWidth="7"
          markerHeight="7"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path
            d="M0,0 L6,3 L0,6"
            fill="none"
            stroke="#234b41"
            strokeWidth="1.5"
          />
        </marker>
      </defs>
      <rect
        x="1"
        y="1"
        width="348"
        height="273"
        rx="14"
        fill="#fff"
        stroke="#d5dfd2"
      />
      {/* Original schematic: front of the face is on the left. No traced anatomy. */}
      <path
        d="M296,43 Q212,12 137,43 Q85,61 74,100 L52,117 L39,131 L62,137 M62,157 L41,166 Q61,174 74,188 Q124,254 250,242 L293,220"
        fill="#f6f3ee"
        stroke="#3d514a"
        strokeWidth="2.5"
      />
      <path
        d="M78,118 Q90,96 113,89 Q162,61 216,82 Q238,91 249,112"
        fill="none"
        stroke="#3d514a"
        strokeWidth="4"
      />
      <path
        d="M216,82 Q247,78 251,112"
        fill="none"
        stroke="#3d514a"
        strokeWidth="3"
        strokeDasharray="5 3"
      />
      <rect
        x="74"
        y="116"
        width="12"
        height="21"
        rx="2"
        fill="#fff"
        stroke="#3d514a"
        strokeWidth="2"
      />
      <rect
        x="73"
        y="161"
        width="12"
        height="18"
        rx="2"
        fill="#fff"
        stroke="#3d514a"
        strokeWidth="2"
      />
      <path
        d={tonguePath(model.place, closure, model.manner)}
        fill="#dba39a"
        stroke="#713f39"
        strokeWidth="2.5"
      />
      {lipClosed ? (
        <path
          d="M39,131 Q50,132 62,146 Q51,164 41,166 Q50,149 40,146 Q49,141 39,131 Z M40,146 H62"
          fill="#dba39a"
          stroke="#713f39"
          strokeWidth="3"
        />
      ) : (
        <path
          d="M39,132 Q48,137 62,137 M41,165 Q50,157 62,157"
          fill="none"
          stroke="#713f39"
          strokeWidth="5"
          strokeLinecap="round"
        />
      )}
      {closure && contact && (
        <text
          x={contact[0] - 6}
          y={contact[1] + 6}
          fill="#713f39"
          fontSize="23"
          fontWeight="700"
        >
          ×
        </text>
      )}
      {!closure && model.aspiration !== "NONE" && (
        <path
          d={
            model.aspiration === "ASPIRATED"
              ? "M52,148 L10,148"
              : "M52,148 L26,148"
          }
          stroke="#234b41"
          strokeWidth={model.aspiration === "ASPIRATED" ? 3.5 : 2}
          strokeDasharray={
            model.aspiration === "CONTINUOUS" ? "3 2" : undefined
          }
          fill="none"
          markerEnd={`url(#${uid}-arrow)`}
        />
      )}
      <g fill="#243b32" fontSize="16" fontFamily="sans-serif">
        <text x="13" y="104">
          1 Môi
        </text>
        <path d="M42,108 L45,124" stroke="#485d52" />
        <text x="13" y="204">
          2 Răng
        </text>
        <path d="M65,198 L78,175" stroke="#485d52" />
        <text x="88" y="58">
          3 Gờ lợi
        </text>
        <path d="M106,62 L112,86" stroke="#485d52" />
        <text x="152" y="40">
          4 Vòm cứng
        </text>
        <path d="M181,45 L181,71" stroke="#485d52" />
        <text x="252" y="80">
          5 Vòm mềm
        </text>
        <path d="M260,85 L239,94" stroke="#485d52" />
        <text x="152" y="204">
          6 Lưỡi
        </text>
        <text x="268" y="255">
          7 Hàm
        </text>
        <path d="M280,241 L274,234" stroke="#485d52" />
      </g>
      <text x="16" y="255" fontSize="12" fill="#243b32">
        {closure
          ? "× Vùng chặn gợi ý"
          : model.aspiration === "ASPIRATED"
            ? "→ Hơi bật sau khi mở"
            : model.aspiration === "CONTINUOUS"
              ? "⇢ Hơi qua khe liên tục"
              : "Tư thế / hơi tương đối"}
      </text>
    </svg>
  );
}
function Mouth({ model }: { model: Illustration }) {
  const uid = useId(),
    round = model.mouth === "ROUND";
  return (
    <svg
      viewBox="0 0 280 190"
      role="img"
      aria-labelledby={`${uid}-title ${uid}-desc`}
    >
      <title id={`${uid}-title`}>
        {`Môi nhìn trước · ${round ? "tròn" : model.mouth === "CLOSED" ? "khép" : model.mouth === "SPREAD" ? "hơi dàn" : "tự nhiên"}`}
      </title>
      <desc id={`${uid}-desc`}>
        Hình môi tự vẽ để gợi ý tư thế; không cho biết vị trí thân lưỡi và không
        đo khẩu hình của bạn. {model.limitations}
      </desc>
      <rect
        x="1"
        y="1"
        width="278"
        height="188"
        rx="14"
        fill="#fff"
        stroke="#d5dfd2"
      />
      <path
        d="M118,22 Q140,38 162,22 M136,39 L132,55 Q140,62 148,55"
        stroke="#3d514a"
        fill="none"
        strokeWidth="2"
      />
      {round ? (
        <>
          <ellipse
            cx="140"
            cy="100"
            rx="39"
            ry="43"
            fill="#dba39a"
            stroke="#713f39"
            strokeWidth="3"
          />
          <ellipse
            cx="140"
            cy="100"
            rx="18"
            ry="26"
            fill="#fff"
            stroke="#713f39"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path
            d="M62,101 Q104,69 140,83 Q176,69 218,101 Q178,133 140,126 Q100,134 62,101 Z"
            fill="#dba39a"
            stroke="#713f39"
            strokeWidth="3"
          />
          <path
            d={
              model.mouth === "CLOSED"
                ? "M70,101 H210"
                : "M72,101 Q140,86 208,101 Q140,114 72,101"
            }
            fill={model.mouth === "CLOSED" ? "none" : "#fff"}
            stroke="#713f39"
            strokeWidth="2"
          />
        </>
      )}
      <text x="140" y="170" textAnchor="middle" fontSize="14" fill="#243b32">
        {round
          ? "Tròn môi ≠ tự động đúng ü"
          : model.mouth === "CLOSED"
            ? "Khép môi · trước khi thả hơi"
            : model.mouth === "SPREAD"
              ? "Hơi dàn, không kéo căng"
              : "Thả lỏng theo vần"}
      </text>
    </svg>
  );
}
function Tone({ model }: { model: Illustration }) {
  const uid = useId();
  const paths = {
    LEVEL: "M64,48 L290,48",
    RISE: "M64,128 Q175,117 290,47",
    DIP: "M64,106 Q152,189 183,157 Q236,126 290,89",
    LOW: "M64,121 Q170,166 290,161",
    FALL: "M64,45 L290,160",
    NONE: "",
  };
  const neutral = model.contour === "NEUTRAL",
    sandhi = model.contour === "SANDHI";
  return (
    <svg
      viewBox="0 0 350 230"
      role="img"
      aria-labelledby={`${uid}-title ${uid}-desc`}
    >
      <title
        id={`${uid}-title`}
      >{`Đường thanh minh hoạ · ${contourName[model.contour]}`}</title>
      <desc id={`${uid}-desc`}>
        Cao độ tương đối theo thời gian, hình giảng dạy lý tưởng hóa, không phải
        âm thanh hoặc F0 đo từ bản ghi.{" "}
        {neutral
          ? "Thanh nhẹ ngắn; vùng gạch nét không gán một cao độ cố định."
          : sandhi
            ? "你好: từ điển 3 + 3, trong cặp khi nói thường 2 + 3; cuối thanh 3 tùy ngữ cảnh."
            : model.description}
      </desc>
      <rect
        x="1"
        y="1"
        width="348"
        height="228"
        rx="14"
        fill="#fff"
        stroke="#d5dfd2"
      />
      <g stroke="#d5dfd2" strokeDasharray="4 4">
        {[48, 104, 160].map((y) => (
          <path key={y} d={`M58,${y} H318`} />
        ))}
      </g>
      <path d="M53,30 V184 H325" stroke="#3d514a" strokeWidth="2" fill="none" />
      <g fill="#243b32" fontSize="12">
        <text x="12" y="48">
          Cao
        </text>
        <text x="9" y="162">
          Thấp
        </text>
        <text x="61" y="213">
          Thời gian → (không theo ms)
        </text>
      </g>
      {neutral ? (
        <>
          <path d="M67,65 H165" stroke="#234b41" strokeWidth="4" />
          <rect
            x="213"
            y="42"
            width="49"
            height="120"
            fill="none"
            stroke="#234b41"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
          <text x="67" y="177" fontSize="14" fill="#243b32">
            mā
          </text>
          <text x="213" y="177" fontSize="14" fill="#243b32">
            ma
          </text>
          <text x="74" y="23" fontSize="12" fill="#243b32">
            māma: âm sau ngắn, cao độ theo ngữ cảnh
          </text>
        </>
      ) : sandhi ? (
        <>
          <path
            d="M66,128 Q118,120 164,49 M197,117 Q244,181 292,124"
            stroke="#234b41"
            strokeWidth="4"
            fill="none"
          />
          <text x="71" y="23" fontSize="12" fill="#243b32">
            nǐ hǎo (3 + 3) → ní hǎo (2 + 3)
          </text>
          <text x="80" y="179" fontSize="14" fill="#243b32">
            ní
          </text>
          <text x="231" y="179" fontSize="14" fill="#243b32">
            hǎo*
          </text>
        </>
      ) : (
        <path
          d={paths[model.contour as keyof typeof paths] ?? ""}
          stroke="#234b41"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
export function ArticulationGuide({ model }: { model: Illustration }) {
  const closing = model.manner === "STOP" || model.manner === "AFFRICATE";
  return (
    <figure className="pron-figure" data-illustration={model.id}>
      {model.kind === "TONE" ? (
        <Tone model={model} />
      ) : model.kind === "TEXT" ? (
        <p>
          Không có một khẩu hình chung cho tất cả các âm. Chọn âm cụ thể để xem
          hình phù hợp.
        </p>
      ) : (
        <>
          <div className="pron-diagram-grid">
            {closing && (
              <div>
                <p className="pron-frame-label">1 · Chặn rất ngắn</p>
                <Tract model={model} closure />
              </div>
            )}
            <div>
              <p className="pron-frame-label">
                {closing ? "2 · Mở và nối sang vần" : "Giữ khe / tư thế gợi ý"}
              </p>
              <Tract model={model} closure={false} />
            </div>
          </div>
          <div className="pron-mouth">
            <Mouth model={model} />
          </div>
        </>
      )}
      <figcaption>
        Sơ đồ tự vẽ · DRAFT chưa duyệt · Không theo tỷ lệ.{" "}
        {model.kind === "TONE"
          ? "Không phải kết quả đo giọng của bạn."
          : "Mũi tên: hơi ra ngoài; ×: vùng chặn gợi ý. Tư thế thực có thể khác giữa người nói."}
      </figcaption>
    </figure>
  );
}

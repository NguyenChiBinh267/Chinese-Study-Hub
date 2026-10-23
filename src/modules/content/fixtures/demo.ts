// Original tiny UI fixtures. No imported corpus, audio, approved answers or publication claim.
// Never wire these to a production content repository.
export type DemoStep = {
  hanzi: string;
  pinyin: string;
  meaning: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
};
export type DemoLesson = {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  type: string;
  steps: DemoStep[];
};
export const demoLessons: DemoLesson[] = [
  {
    id: "F01",
    title: "Làm quen với pinyin",
    subtitle: "Bước đầu đọc âm tiếng Trung",
    minutes: 15,
    type: "Nền tảng",
    steps: [
      {
        hanzi: "妈",
        pinyin: "mā",
        meaning: "mẹ",
        prompt: "Trong ví dụ này, pinyin của 妈 là gì?",
        choices: ["mā", "má", "mǎ"],
        answer: 0,
        explanation:
          "Fixture dùng mā với dấu ngang (thanh 1). Đây là nhận diện chữ viết, chưa kiểm tra nghe hoặc phát âm.",
      },
      {
        hanzi: "你",
        pinyin: "nǐ",
        meaning: "bạn",
        prompt: "Chọn pinyin khớp với ví dụ trên.",
        choices: ["ní", "nǐ", "nì"],
        answer: 1,
        explanation:
          "Pinyin dạng từ điển của 你 là nǐ. Demo chỉ phản hồi theo đáp án fixture, không tính mastery.",
      },
    ],
  },
  {
    id: "F02",
    title: "Nhận diện dấu thanh",
    subtitle: "Quan sát bốn dấu thanh cơ bản",
    minutes: 15,
    type: "Nền tảng",
    steps: [
      {
        hanzi: "麻",
        pinyin: "má",
        meaning: "cây gai",
        prompt: "Dấu sắc trong má biểu thị thanh mấy?",
        choices: ["Thanh 1", "Thanh 2", "Thanh 4"],
        answer: 1,
        explanation:
          "Trong ký hiệu pinyin, á là thanh 2. Chưa có audio được duyệt để luyện phân biệt âm.",
      },
      {
        hanzi: "骂",
        pinyin: "mà",
        meaning: "mắng",
        prompt: "Chọn ký hiệu của thanh 4.",
        choices: ["ā", "ǎ", "à"],
        answer: 2,
        explanation:
          "Dấu huyền trong pinyin biểu thị thanh 4. Không suy khả năng phát âm từ câu hỏi nhận diện này.",
      },
    ],
  },
  {
    id: "L001",
    title: "Lời chào đầu tiên",
    subtitle: "Một lời chào, một khởi đầu",
    minutes: 15,
    type: "Giao tiếp",
    steps: [
      {
        hanzi: "你好",
        pinyin: "nǐ hǎo",
        meaning: "xin chào",
        prompt: "你好 được dùng để làm gì?",
        choices: ["Chào hỏi", "Cảm ơn", "Tạm biệt"],
        answer: 0,
        explanation:
          "你好 là lời chào. Pinyin ở đây là dạng từ điển; cách phát âm trong ngữ cảnh cần audio được duyệt.",
      },
      {
        hanzi: "我叫安",
        pinyin: "wǒ jiào Ān",
        meaning: "Tôi tên là An",
        prompt: "Câu này giới thiệu thông tin gì?",
        choices: ["Sở thích", "Tên", "Tuổi"],
        answer: 1,
        explanation:
          "我叫… là mẫu giới thiệu tên trong fixture. Ví dụ chưa qua kiểm duyệt ngôn ngữ và không phải học liệu xuất bản.",
      },
    ],
  },
  {
    id: "L002",
    title: "Nói về sở thích",
    subtitle: "Bắt đầu một cuộc trò chuyện",
    minutes: 15,
    type: "Giao tiếp",
    steps: [
      {
        hanzi: "我喜欢茶",
        pinyin: "wǒ xǐhuan chá",
        meaning: "Tôi thích trà",
        prompt: "Người nói thích gì?",
        choices: ["Nước", "Trà", "Cà phê"],
        answer: 1,
        explanation:
          "茶 nghĩa là trà. Đây là câu mẫu để thử giao diện đọc hiểu, chưa có chấm bài thật.",
      },
      {
        hanzi: "你呢",
        pinyin: "nǐ ne",
        meaning: "Còn bạn thì sao?",
        prompt: "Chọn nghĩa khớp với ví dụ.",
        choices: ["Tôi cũng vậy", "Cảm ơn bạn", "Còn bạn thì sao?"],
        answer: 2,
        explanation:
          "你呢 có thể dùng để hỏi lại người đối thoại trong ngữ cảnh phù hợp. Demo không mở khóa bài hay đánh giá năng lực.",
      },
    ],
  },
];
export const demoCards = demoLessons.map((lesson) => ({
  id: lesson.id,
  ...lesson.steps[0],
}));

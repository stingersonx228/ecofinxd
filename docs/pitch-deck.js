const pptxgen = require("pptxgenjs");

const OUT = process.argv[2];

// Палитра продукта — те же токены, что в app/globals.css
const DARK = "204230";   // brand-800
const MID = "2E6748";    // brand-600
const LIGHT = "DCECE1";  // brand-100
const PALE = "F0F7F2";   // brand-50
const BG = "F6F8F6";
const INK = "12211A";
const MUTED = "5C6F65";
const OVER = "B3402F";
const WHITE = "FFFFFF";

const HEAD = "Cambria";
const BODY = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
pres.author = "EcoFin";
pres.title = "EcoFin — питч";

const W = 13.3;
const M = 0.7; // поле

function card(slide, x, y, w, h, fill) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: fill || WHITE },
    line: { color: LIGHT, width: 1 },
  });
}

function title(slide, text, color) {
  slide.addText(text, {
    x: M, y: 0.5, w: W - M * 2, h: 0.9,
    fontFace: HEAD, fontSize: 34, bold: true,
    color: color || INK, align: "left", margin: 0,
  });
}

function kicker(slide, text, color) {
  slide.addText(text, {
    x: M, y: 0.28, w: W - M * 2, h: 0.3,
    fontFace: BODY, fontSize: 12, bold: true,
    color: color || MID, charSpacing: 1.5, margin: 0,
  });
}

function light(slide) {
  slide.background = { color: BG };
}

// ───────────────────────────────────────── 1. Титул
{
  const s = pres.addSlide();
  s.background = { color: DARK };

  s.addText("EcoFin", {
    x: M, y: 1.6, w: 7.4, h: 1.1,
    fontFace: HEAD, fontSize: 60, bold: true, color: WHITE, margin: 0,
  });

  s.addText("Где утекают ресурсы и сколько тенге можно вернуть", {
    x: M, y: 2.75, w: 7.2, h: 1.0,
    fontFace: BODY, fontSize: 22, color: LIGHT, margin: 0,
  });

  s.addText(
    "AI-платформа ресурсоэффективности для домохозяйств,\nшкол и малого бизнеса Казахстана",
    { x: M, y: 3.9, w: 7.2, h: 0.9, fontFace: BODY, fontSize: 14, color: "9FC0AC", margin: 0, lineSpacing: 20 },
  );

  s.addText("ecofin-chi.vercel.app", {
    x: M, y: 6.35, w: 6, h: 0.35,
    fontFace: BODY, fontSize: 13, bold: true, color: LIGHT, margin: 0,
  });

  // Карточка-хук с реальным результатом
  s.addShape(pres.ShapeType.roundRect, {
    x: 8.7, y: 1.9, w: 3.9, h: 3.3, rectRadius: 0.1,
    fill: { color: MID }, line: { color: "3F815B", width: 1 },
  });
  s.addText("Школа-гимназия на 500 учащихся", {
    x: 9.0, y: 2.2, w: 3.3, h: 0.5, fontFace: BODY, fontSize: 12, color: LIGHT, margin: 0,
  });
  s.addText("36 480 ₸", {
    x: 9.0, y: 2.75, w: 3.3, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: WHITE, margin: 0,
  });
  s.addText("в месяц — найденная экономия", {
    x: 9.0, y: 3.6, w: 3.3, h: 0.4, fontFace: BODY, fontSize: 13, color: LIGHT, margin: 0,
  });
  s.addText("437 760 ₸ в год", {
    x: 9.0, y: 4.15, w: 3.3, h: 0.5, fontFace: BODY, fontSize: 18, bold: true, color: WHITE, margin: 0,
  });
  s.addText("Реальный вывод платформы на демо-профиле", {
    x: 8.7, y: 5.35, w: 3.9, h: 0.4, fontFace: BODY, fontSize: 10, color: "9FC0AC", margin: 0, italic: true,
  });

  s.addNotes("Приветствие. EcoFin отвечает на два вопроса, на которые не отвечает квитанция: много это или мало, и что делать.");
}

// ───────────────────────────────────────── 2. Проблема
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "ПРОБЛЕМА");
  title(s, "Квитанция показывает сумму — и больше ничего");

  const items = [
    ["Много это или мало?", "Не с чем сравнить. Нет понимания, нормальный ли расход для объекта такого типа и размера."],
    ["Что конкретно сделать?", "Советы уровня «экономьте воду» не превращаются в действия и не дают результата."],
    ["Сколько я верну?", "Без цифры в тенге меры не проходят согласование ни в семье, ни в бюджете учреждения."],
  ];

  items.forEach((it, i) => {
    const x = M + i * 4.07;
    card(s, x, 1.85, 3.77, 2.5);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.3, y: 2.15, w: 0.5, h: 0.5, fill: { color: PALE }, line: { color: LIGHT, width: 1 },
    });
    s.addText(String(i + 1), {
      x: x + 0.3, y: 2.15, w: 0.5, h: 0.5, fontFace: HEAD, fontSize: 16, bold: true,
      color: MID, align: "center", valign: "middle", margin: 0,
    });
    s.addText(it[0], {
      x: x + 0.3, y: 2.8, w: 3.17, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: INK, margin: 0,
    });
    s.addText(it[1], {
      x: x + 0.3, y: 3.25, w: 3.17, h: 0.95, fontFace: BODY, fontSize: 13, color: MUTED, margin: 0, lineSpacing: 17, valign: "top",
    });
  });

  card(s, M, 4.7, W - M * 2, 1.55, PALE);
  s.addText("Энергоаудит стоит денег и доступен единицам", {
    x: M + 0.45, y: 4.95, w: 11.0, h: 0.4, fontFace: HEAD, fontSize: 19, bold: true, color: DARK, margin: 0,
  });
  s.addText(
    "Обследование здания — это выезд специалиста, приборы и счёт на сотни тысяч тенге. Для квартиры, сельской школы или кофейни такой порог непреодолим, поэтому перерасход просто оплачивается годами.",
    { x: M + 0.45, y: 5.4, w: 11.0, h: 0.7, fontFace: BODY, fontSize: 13, color: MUTED, margin: 0, lineSpacing: 17 },
  );

  s.addNotes("Проблема не в отсутствии желания экономить, а в отсутствии дешёвой диагностики.");
}

// ───────────────────────────────────────── 3. Решение
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "РЕШЕНИЕ");
  title(s, "Три цифры из квитанции — и конкретный план");

  s.addText(
    "EcoFin сравнивает потребление объекта со средним по его региону для объектов того же типа, находит перерасход и с помощью Claude формирует меры под конкретный объект. Каждая мера переведена в тенге по тарифам.",
    { x: M, y: 1.75, w: 6.0, h: 1.6, fontFace: BODY, fontSize: 15, color: INK, margin: 0, lineSpacing: 22 },
  );

  s.addText("Без датчиков. Без выезда специалиста.\nБез регистрации. Около минуты.", {
    x: M, y: 3.5, w: 6.0, h: 0.9, fontFace: HEAD, fontSize: 17, bold: true, italic: true,
    color: MID, margin: 0, lineSpacing: 26,
  });

  const gets = [
    "Сравнение с региональной нормой по трём ресурсам",
    "От трёх до восьми конкретных мер под тип объекта",
    "Экономия каждой меры в тенге в месяц",
    "Отметка «применил» и подсчёт фактического результата",
    "Разрез по подразделениям для школ и бизнеса",
  ];

  card(s, 7.1, 1.7, 5.5, 3.95);
  s.addText("Что получает пользователь", {
    x: 7.5, y: 2.0, w: 4.7, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: DARK, margin: 0,
  });
  s.addText(
    gets.map((g, i) => ({ text: g, options: { bullet: true, breakLine: i !== gets.length - 1 } })),
    { x: 7.5, y: 2.55, w: 4.7, h: 3.4, fontFace: BODY, fontSize: 14, color: INK, margin: 0, paraSpaceAfter: 12, lineSpacing: 19, valign: "top" },
  );

  s.addNotes("Ключевая мысль: порог входа снижен до трёх чисел.");
}

// ───────────────────────────────────────── 4. Как это работает
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "КАК ЭТО РАБОТАЕТ");
  title(s, "Три шага пользователя, четыре — платформы");

  const steps = [
    ["01", "Ввод показаний", "Тип объекта, регион и потребление за месяц: электричество, вода, отходы. Отходы необязательны."],
    ["02", "Сравнение с нормой", "Платформа берёт бенчмарк по региону и типу объекта, считает отклонение по каждому ресурсу."],
    ["03", "Анализ Claude", "Модель получает карточку объекта с готовыми отклонениями и предлагает меры, привязанные к этим цифрам."],
    ["04", "Экономия в тенге", "Оценку модели в кВт·ч, м³ и кг платформа переводит в деньги по тарифам и показывает итог."],
  ];

  steps.forEach((st, i) => {
    const x = M + i * 3.05;
    card(s, x, 1.9, 2.8, 3.5);
    s.addText(st[0], {
      x: x + 0.28, y: 2.15, w: 1.2, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: "90BFA2", margin: 0,
    });
    s.addText(st[1], {
      x: x + 0.28, y: 2.85, w: 2.25, h: 0.55, fontFace: HEAD, fontSize: 16, bold: true, color: INK, margin: 0,
    });
    s.addText(st[2], {
      x: x + 0.28, y: 3.42, w: 2.25, h: 1.75, fontFace: BODY, fontSize: 12, color: MUTED, margin: 0, lineSpacing: 16, valign: "top",
    });
  });

  card(s, M, 5.7, W - M * 2, 0.85, PALE);
  s.addText(
    "Деньги считает платформа, а не модель: тарифы и арифметика — детерминированный код, а не текст языковой модели.",
    { x: M + 0.45, y: 5.85, w: 11.0, h: 0.55, fontFace: BODY, fontSize: 14, bold: true, color: DARK, margin: 0, valign: "middle" },
  );

  s.addNotes("Подчеркнуть разделение ролей: модель — эксперт, платформа — бухгалтер.");
}

// ───────────────────────────────────────── 5. Результат на реальных данных
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "РЕЗУЛЬТАТ");
  title(s, "Что платформа находит на реальном профиле");

  s.addChart(
    pres.ChartType.bar,
    [
      { name: "Норма по региону", labels: ["Электричество", "Вода", "Отходы"], values: [100, 100, 100] },
      { name: "Школа-гимназия №21", labels: ["Электричество", "Вода", "Отходы"], values: [129, 129, 120] },
    ],
    {
      x: M, y: 1.85, w: 6.6, h: 4.3,
      barDir: "col",
      chartColors: [LIGHT, OVER],
      showTitle: true,
      title: "Потребление в % от нормы",
      titleFontFace: HEAD, titleFontSize: 14, titleColor: INK,
      showValue: true, dataLabelPosition: "outEnd",
      dataLabelFontFace: BODY, dataLabelFontSize: 10, dataLabelColor: MUTED,
      dataLabelFormatCode: '0"%"',
      showLegend: true, legendPos: "b", legendFontFace: BODY, legendFontSize: 11, legendColor: MUTED,
      catAxisLabelFontFace: BODY, catAxisLabelFontSize: 11, catAxisLabelColor: MUTED,
      valAxisLabelFontFace: BODY, valAxisLabelFontSize: 10, valAxisLabelColor: MUTED,
      valGridLine: { color: LIGHT, size: 1 },
      catGridLine: { style: "none" },
      valAxisMaxVal: 150,
      valAxisMinVal: 0,
      barGapWidthPct: 60,
    },
  );

  const stats = [
    ["Школа", "36 480 ₸", "8 мер, перерасход по всем трём ресурсам"],
    ["Кофейня", "15 120 ₸", "8 мер, холодильное оборудование и мойка"],
    ["Квартира", "4 130 ₸", "6 мер, техника и сантехника"],
  ];

  stats.forEach((st, i) => {
    const y = 1.85 + i * 1.48;
    card(s, 7.6, y, 5.0, 1.28);
    s.addText(st[0], {
      x: 7.95, y: y + 0.15, w: 1.6, h: 0.35, fontFace: BODY, fontSize: 12, bold: true, color: MUTED, margin: 0,
    });
    s.addText(st[1], {
      x: 7.95, y: y + 0.45, w: 2.4, h: 0.55, fontFace: HEAD, fontSize: 26, bold: true, color: DARK, margin: 0,
    });
    s.addText("в месяц", {
      x: 10.3, y: y + 0.62, w: 1.0, h: 0.3, fontFace: BODY, fontSize: 11, color: MUTED, margin: 0,
    });
    s.addText(st[2], {
      x: 7.95, y: y + 0.97, w: 4.3, h: 0.28, fontFace: BODY, fontSize: 10, color: MUTED, margin: 0,
    });
  });

  s.addText(
    "Цифры получены живыми запросами к модели на демо-профилях. Тарифы и региональные нормы в прототипе — примерные значения.",
    { x: M, y: 6.45, w: W - M * 2, h: 0.4, fontFace: BODY, fontSize: 10, italic: true, color: MUTED, margin: 0 },
  );

  s.addNotes("Три разных типа объекта дают три разных набора мер — это проверялось.");
}

// ───────────────────────────────────────── 6. AI-модуль
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  kicker(s, "ЯДРО ПРОДУКТА", "9FC0AC");
  title(s, "Почему это не обёртка над чат-ботом", WHITE);

  const points = [
    ["Модель не считает деньги", "Она оценивает экономию только в кВт·ч, м³ и кг. Перевод в тенге — код по тарифам. Модель ошибается в арифметике, а цифра экономии — главный экран продукта."],
    ["Форма ответа задана схемой API", "Не просьбой в промпте, а JSON Schema в output_config. Markdown-обёртка и преамбула невозможны на уровне протокола."],
    ["Невозможные меры отбрасываются", "Если заявленная экономия больше текущего потребления по ресурсу, рекомендация выкидывается до показа пользователю."],
    ["Отклонения считает платформа", "Модель получает готовый перерасход в процентах и не тратит внимание на арифметику."],
  ];

  points.forEach((p, i) => {
    const x = M + (i % 2) * 6.15;
    const y = 1.95 + Math.floor(i / 2) * 2.25;
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 5.75, h: 1.95, rectRadius: 0.08,
      fill: { color: MID }, line: { color: "3F815B", width: 1 },
    });
    s.addText(p[0], {
      x: x + 0.35, y: y + 0.22, w: 5.05, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: WHITE, margin: 0,
    });
    s.addText(p[1], {
      x: x + 0.35, y: y + 0.68, w: 5.05, h: 1.1, fontFace: BODY, fontSize: 12, color: LIGHT, margin: 0, lineSpacing: 16, valign: "top",
    });
  });

  s.addText("Сбой API не роняет страницу: шесть типов отказа переводятся в понятный текст с кнопкой повтора.", {
    x: M, y: 6.5, w: W - M * 2, h: 0.4, fontFace: BODY, fontSize: 12, italic: true, color: "9FC0AC", margin: 0,
  });

  s.addNotes("Это слайд для критерия «использование ИИ». Показать, что риски модели закрыты инженерно.");
}

// ───────────────────────────────────────── 7. Пример вывода
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "ПРИМЕР ВЫВОДА");
  title(s, "Так выглядит рекомендация, а не «экономьте свет»");

  card(s, M, 1.8, W - M * 2, 2.05);
  s.addText("ЭЛЕКТРИЧЕСТВО   ·   −650 кВт·ч/мес   ·   16 250 ₸/мес", {
    x: M + 0.45, y: 2.05, w: 11.0, h: 0.32, fontFace: BODY, fontSize: 11, bold: true, color: MID, margin: 0, charSpacing: 0.5,
  });
  s.addText(
    "«Замените люминесцентные лампы и лампы накаливания в классах и коридорах на светодиодные аналоги, 10–12 Вт вместо 40–60 Вт, особенно в кабинетах с продлённым освещением из-за коротких зимних дней в ЗКО.»",
    { x: M + 0.45, y: 2.45, w: 11.0, h: 1.2, fontFace: HEAD, fontSize: 16, color: INK, margin: 0, lineSpacing: 24 },
  );

  card(s, M, 4.05, W - M * 2, 1.75, PALE);
  s.addText("Обоснование, которое модель возвращает вместе с мерой", {
    x: M + 0.45, y: 4.25, w: 11.0, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: MUTED, margin: 0,
  });
  s.addText(
    "«При перерасходе 1400 кВт·ч замена освещения даёт наибольший эффект: в учебных заведениях свет работает 8–10 часов ежедневно, особенно зимой при коротком световом дне на западе Казахстана. LED снижает потребление освещения на 60–70%, что при типовой доле освещения в балансе школы около 25–30% даёт порядка 650 кВт·ч в месяц.»",
    { x: M + 0.45, y: 4.6, w: 11.0, h: 1.05, fontFace: BODY, fontSize: 12.5, color: INK, margin: 0, lineSpacing: 17 },
  );

  s.addText(
    "Привязка к цифрам объекта, к его типу и к климату региона. Общие советы системный промпт запрещает напрямую.",
    { x: M, y: 6.1, w: W - M * 2, h: 0.5, fontFace: BODY, fontSize: 13, bold: true, color: DARK, margin: 0 },
  );

  s.addNotes("Прочитать вслух первую цитату — она сама себя продаёт.");
}

// ───────────────────────────────────────── 8. Аудитория
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "ЦЕЛЕВАЯ АУДИТОРИЯ");
  title(s, "Три сегмента, один механизм");

  const auds = [
    ["Домохозяйства", "Квартиры и частные дома", [
      "Счёт заметен в семейном бюджете",
      "Нет доступа к аудиту в принципе",
      "Точка входа и канал распространения",
    ]],
    ["Школы и детские сады", "Бюджетные учреждения", [
      "Экономия — прямая задача завхоза",
      "Разрез по корпусам и классам",
      "Готовый аргумент для отчёта",
    ]],
    ["Малый бизнес", "Кафе, магазины, офисы, цеха", [
      "Коммуналка — постоянная статья",
      "Решение принимается за день",
      "Готовность платить за инструмент",
    ]],
  ];

  auds.forEach((a, i) => {
    const x = M + i * 4.07;
    card(s, x, 1.85, 3.77, 3.45);
    s.addText(a[0], {
      x: x + 0.35, y: 2.15, w: 3.1, h: 0.45, fontFace: HEAD, fontSize: 20, bold: true, color: DARK, margin: 0,
    });
    s.addText(a[1], {
      x: x + 0.35, y: 2.62, w: 3.1, h: 0.32, fontFace: BODY, fontSize: 11, color: MUTED, margin: 0,
    });
    s.addText(
      a[2].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k !== a[2].length - 1 } })),
      { x: x + 0.35, y: 3.15, w: 3.1, h: 2.6, fontFace: BODY, fontSize: 13, color: INK, margin: 0, paraSpaceAfter: 12, lineSpacing: 18, valign: "top" },
    );
  });

  s.addNotes("Домохозяйства дают охват, организации — деньги.");
}

// ───────────────────────────────────────── 9. Бизнес-модель
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "БИЗНЕС-МОДЕЛЬ");
  title(s, "Бесплатно для людей, подписка для организаций");

  const tiers = [
    ["Домохозяйства", "Бесплатно", "Один объект, анализ и рекомендации. Канал привлечения и источник данных о реальном потреблении.", PALE, DARK],
    ["Школы и бизнес", "Подписка", "Подразделения, история по месяцам, отчёт для руководства и подтверждение эффекта после внедрения.", MID, WHITE],
    ["Акиматы и сети", "По договору", "Портфель объектов, сравнение школ между собой, выгрузка для программ энергосбережения.", PALE, DARK],
  ];

  tiers.forEach((t, i) => {
    const x = M + i * 4.07;
    const isMid = t[3] === MID;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.85, w: 3.77, h: 3.15, rectRadius: 0.08,
      fill: { color: t[3] }, line: { color: isMid ? "3F815B" : LIGHT, width: 1 },
    });
    s.addText(t[0], {
      x: x + 0.35, y: 2.1, w: 3.1, h: 0.35, fontFace: BODY, fontSize: 12, bold: true,
      color: isMid ? LIGHT : MUTED, margin: 0,
    });
    s.addText(t[1], {
      x: x + 0.35, y: 2.5, w: 3.1, h: 0.5, fontFace: HEAD, fontSize: 21, bold: true, color: t[4], margin: 0,
    });
    s.addText(t[2], {
      x: x + 0.35, y: 3.1, w: 3.1, h: 1.6, fontFace: BODY, fontSize: 12, valign: "top",
      color: isMid ? LIGHT : MUTED, margin: 0, lineSpacing: 17,
    });
  });

  card(s, M, 5.3, W - M * 2, 1.15);
  s.addText("Почему за это платят", {
    x: M + 0.45, y: 5.45, w: 5.0, h: 0.32, fontFace: HEAD, fontSize: 15, bold: true, color: DARK, margin: 0,
  });
  s.addText(
    "Подписка окупается первой же внедрённой мерой: одна школа из демо получает 36 тысяч тенге в месяц. Продукт продаёт себя посчитанной экономией, а не обещанием.",
    { x: M + 0.45, y: 5.8, w: 11.0, h: 0.5, fontFace: BODY, fontSize: 13, color: MUTED, margin: 0, lineSpacing: 17 },
  );

  s.addNotes("Модель предложенная, не проверенная продажами — сказать честно, если спросят.");
}

// ───────────────────────────────────────── 10. Стек
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "ТЕХНОЛОГИЧЕСКИЙ СТЕК");
  title(s, "Что под капотом");

  const stack = [
    ["Фронтенд и сервер", "Next.js 16, App Router, React 19, TypeScript strict, Tailwind CSS v4"],
    ["База данных", "Supabase, PostgreSQL 17. Шесть таблиц, RLS, транзакционное создание профиля через plpgsql-функцию"],
    ["AI", "Anthropic API, claude-sonnet-5, structured outputs с JSON Schema, adaptive thinking"],
    ["Визуализация", "Recharts"],
    ["Хостинг", "Vercel, автодеплой из main"],
  ];

  card(s, M, 1.8, 6.3, 4.55);
  stack.forEach((row, i) => {
    const y = 2.05 + i * 0.85;
    s.addText(row[0], {
      x: M + 0.4, y, w: 5.5, h: 0.28, fontFace: BODY, fontSize: 11, bold: true, color: MID, margin: 0,
    });
    s.addText(row[1], {
      x: M + 0.4, y: y + 0.28, w: 5.5, h: 0.5, fontFace: BODY, fontSize: 12.5, color: INK, margin: 0, lineSpacing: 16,
    });
  });

  card(s, 7.4, 1.8, 5.2, 4.55, PALE);
  s.addText("Поток данных", {
    x: 7.8, y: 2.05, w: 4.4, h: 0.35, fontFace: HEAD, fontSize: 17, bold: true, color: DARK, margin: 0,
  });

  const flow = [
    "Онбординг → профиль и показатели создаются одной транзакцией",
    "Дашборд читает профиль, бенчмарки и рекомендации на сервере",
    "Генерация → Claude → валидация ответа → перевод в тенге → запись",
    "Отметка «применил» пересчитывает итоговую экономию",
  ];

  flow.forEach((f, i) => {
    const y = 2.65 + i * 0.9;
    s.addShape(pres.ShapeType.ellipse, {
      x: 7.8, y, w: 0.34, h: 0.34, fill: { color: MID }, line: { color: MID, width: 1 },
    });
    s.addText(String(i + 1), {
      x: 7.8, y, w: 0.34, h: 0.34, fontFace: BODY, fontSize: 11, bold: true,
      color: WHITE, align: "center", valign: "middle", margin: 0,
    });
    s.addText(f, {
      x: 8.3, y: y - 0.02, w: 3.95, h: 0.75, fontFace: BODY, fontSize: 12, color: INK, margin: 0, lineSpacing: 16, valign: "top",
    });
  });

  s.addNotes("Код открыт, ссылка на репозиторий на последнем слайде.");
}

// ───────────────────────────────────────── 11. Честно о прототипе
{
  const s = pres.addSlide();
  light(s);
  kicker(s, "ЧЕСТНО О ПРОТОТИПЕ");
  title(s, "Что работает по-настоящему, а что — оценка");

  card(s, M, 1.85, 5.9, 4.3);
  s.addText("Работает по-настоящему", {
    x: M + 0.4, y: 2.1, w: 5.1, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: MID, margin: 0,
  });
  const real = [
    "Создание профиля — запись в PostgreSQL одной транзакцией",
    "Рекомендации — живой вызов модели на введённых данных, заготовок в коде нет",
    "Расчёт экономии в тенге — детерминированный код",
    "Сравнение с нормой, отклонения, панель подразделений",
  ];
  s.addText(
    real.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i !== real.length - 1 } })),
    { x: M + 0.4, y: 2.65, w: 5.1, h: 3.2, fontFace: BODY, fontSize: 13, color: INK, margin: 0, paraSpaceAfter: 12, lineSpacing: 18, valign: "top" },
  );

  card(s, 7.0, 1.85, 5.6, 4.3);
  s.addText("Требует замены перед боем", {
    x: 7.4, y: 2.1, w: 4.8, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: OVER, margin: 0,
  });
  const mock = [
    "Тарифы 25 ₸/кВт·ч, 180 ₸/м³, 12 ₸/кг — порядок величины, не выверенные значения",
    "Региональные нормы — экспертная оценка по открытым данным БНС РК",
    "Собственные нормы заведены для четырёх регионов, для остальных — общестрановой откат",
    "Аутентификации нет: профиль хранится в localStorage, политики доступа демонстрационные",
  ];
  s.addText(
    mock.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i !== mock.length - 1 } })),
    { x: 7.4, y: 2.65, w: 4.8, h: 3.2, fontFace: BODY, fontSize: 13, color: INK, margin: 0, paraSpaceAfter: 12, lineSpacing: 18, valign: "top" },
  );

  s.addText(
    "Все ограничения перечислены в README репозитория. Замена тарифов и норм — правка двух файлов, архитектуру не затрагивает.",
    { x: M, y: 6.4, w: W - M * 2, h: 0.4, fontFace: BODY, fontSize: 12, italic: true, color: MUTED, margin: 0 },
  );

  s.addNotes("Этот слайд обезоруживает вопрос жюри про достоверность цифр. Лучше сказать самим.");
}

// ───────────────────────────────────────── 12. Дальше + команда
{
  const s = pres.addSlide();
  s.background = { color: DARK };
  kicker(s, "ЧТО ДАЛЬШЕ", "9FC0AC");
  title(s, "Дорожная карта и команда", WHITE);

  const road = [
    ["Ближайшее", "Реальные тарифы по регионам, аутентификация, история показаний по месяцам"],
    ["Затем", "Подтверждение эффекта: сравнение расхода до и после внедрённой меры вместо оценки"],
    ["Дальше", "Стоимость внедрения и срок окупаемости, импорт показаний фотографией квитанции"],
  ];

  road.forEach((r, i) => {
    const x = M + i * 4.07;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.95, w: 3.77, h: 1.95, rectRadius: 0.08,
      fill: { color: MID }, line: { color: "3F815B", width: 1 },
    });
    s.addText(r[0], {
      x: x + 0.35, y: 2.2, w: 3.1, h: 0.35, fontFace: BODY, fontSize: 11, bold: true, color: LIGHT, margin: 0, charSpacing: 1,
    });
    s.addText(r[1], {
      x: x + 0.35, y: 2.6, w: 3.1, h: 1.15, fontFace: BODY, fontSize: 12.5, color: WHITE, margin: 0, lineSpacing: 17, valign: "top",
    });
  });

  s.addText("Команда", {
    x: M, y: 4.35, w: 5.5, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: WHITE, margin: 0,
  });
  s.addText("[Имя Фамилия] — соло-проект: продукт, разработка, дизайн", {
    x: M, y: 4.8, w: 6.0, h: 0.4, fontFace: BODY, fontSize: 14, color: LIGHT, margin: 0,
  });

  s.addText("Ссылки", {
    x: 7.1, y: 4.35, w: 5.5, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: WHITE, margin: 0,
  });
  s.addText(
    [
      { text: "Прототип:  ecofin-chi.vercel.app", options: { breakLine: true } },
      { text: "Код:  github.com/stingersonx228/ecofin", options: { breakLine: true } },
      { text: "Видео:  [ссылка]", options: {} },
    ],
    { x: 7.1, y: 4.8, w: 5.5, h: 1.2, fontFace: BODY, fontSize: 14, color: LIGHT, margin: 0, lineSpacing: 22 },
  );

  s.addText("Три цифры из квитанции — конкретный план и деньги.", {
    x: M, y: 6.45, w: 11.0, h: 0.45, fontFace: HEAD, fontSize: 18, bold: true, italic: true, color: "9FC0AC", margin: 0,
  });

  s.addNotes("Закрыть цифрой экономии и ссылкой на живой прототип.");
}

pres.writeFile({ fileName: OUT }).then(() => console.log("written:", OUT));

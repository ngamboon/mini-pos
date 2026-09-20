export async function POST(request) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return Response.json(
      { ok: false, error: "ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN หรือ TELEGRAM_CHAT_ID" },
      { status: 500 }
    );
  }

  try {
    const { text } = await request.json();

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const res = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      // Telegram ตอบกลับมาว่ามีปัญหา (เช่น chat_id ผิด, token ผิด)
      return Response.json({ ok: false, error: data.description }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    // ปัญหาเชิงเทคนิค เช่น network error หรือ JSON parse ผิดพลาด
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

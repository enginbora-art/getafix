const nodemailer = require('nodemailer');
const { marked } = require('marked');
const prisma = require('../lib/prisma');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: parseInt(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const EMAIL_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         max-width: 720px; margin: 0 auto; padding: 24px;
         background: #0f172a; color: #e2e8f0; }
  h1, h2, h3 { color: #2dd4bf; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 10px 14px; border: 1px solid #334155; text-align: left; }
  th { background: #1e293b; color: #94a3b8; font-size: 12px; }
  td { background: #1e293b; }
  strong { color: #f1f5f9; }
  blockquote { border-left: 3px solid #f59e0b; background: #1c1a0e;
               padding: 10px 14px; margin: 12px 0; color: #fbbf24; }
  hr { border: 0; border-top: 1px solid #334155; margin: 20px 0; }
  code { background: #1e293b; padding: 2px 6px; border-radius: 4px;
         font-family: monospace; color: #2dd4bf; }
`;

async function sendMail({ to, subject, markdownBody }) {
  const html = `<html><head><style>${EMAIL_CSS}</style></head>
    <body>${marked(markdownBody)}</body></html>`;

  return transporter.sendMail({
    from: `"Getafix" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    text: markdownBody,
    html,
  });
}

async function sendForecastEmail(markdownReport, market, date) {
  const dateStr = new Date(date).toLocaleDateString('tr-TR');
  const subject = `${market} Günlük Öneri — ${dateStr}`;

  let users = [];
  try {
    users = await prisma.user.findMany({
      where: { isActive: true },
      select: { email: true },
    });
  } catch (err) {
    console.error('[EMAIL] Kullanıcı listesi alınamadı:', err.message);
    return;
  }

  if (!users.length) {
    console.warn('[EMAIL] Aktif kullanıcı yok, mail atlanıyor');
    return;
  }

  console.log(`[EMAIL] ${users.length} kullanıcıya ${market} raporu gönderiliyor`);

  const batchSize = 10;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map((u) => sendMail({ to: u.email, subject, markdownBody: markdownReport })),
    );
  }

  console.log(`[EMAIL] ${market} raporu gönderildi`);
}

async function sendWelcomeEmail({ to, name, tempPassword }) {
  const markdownBody = `# Getafix'e Hoş Geldiniz, ${name}!

Hesabınız oluşturuldu. Giriş bilgileriniz:

| | |
|---|---|
| **E-posta** | ${to} |
| **Geçici şifre** | ${tempPassword} |

İlk girişte şifrenizi değiştirmenizi öneririz.

[Giriş Yap](${process.env.FRONTEND_URL}/login)

---
> Getafix — Yatırım tavsiyesi değildir. Karar destek aracıdır.`;

  return sendMail({
    to,
    subject: 'Getafix — Hesabınız Hazır',
    markdownBody,
  });
}

async function sendErrorEmail(error, context) {
  let admins = [];
  try {
    admins = await prisma.user.findMany({
      where: { isActive: true, role: 'ADMIN' },
      select: { email: true },
    });
  } catch (err) {
    console.error('[EMAIL] Admin listesi alınamadı');
    return;
  }

  const markdownBody = `# ⚠️ Getafix Sistem Hatası

**Bağlam:** ${context}

**Hata:**
\`\`\`
${error}
\`\`\`

Detaylar log dosyasında.`;

  await Promise.allSettled(
    admins.map((a) =>
      sendMail({
        to: a.email,
        subject: `Getafix HATA — ${context}`,
        markdownBody,
      }),
    ),
  );
}

module.exports = { sendForecastEmail, sendWelcomeEmail, sendErrorEmail };

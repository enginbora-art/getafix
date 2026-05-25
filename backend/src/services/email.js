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
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f1f5f9;
    color: #0f172a;
    padding: 24px 16px;
  }
  .email-wrapper {
    max-width: 680px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  .email-header {
    background: #0a0f1e;
    padding: 20px 28px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 2px solid #1D9E75;
  }
  .email-header .logo-text {
    font-size: 20px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: #f8fafc;
  }
  .email-header .logo-text span { color: #2dd4bf; }
  .email-body {
    padding: 28px;
    color: #0f172a;
    line-height: 1.7;
  }
  h1 {
    font-size: 22px;
    font-weight: 600;
    color: #0f172a;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 18px;
    font-weight: 600;
    color: #0f172a;
    margin: 20px 0 10px;
  }
  h3 {
    font-size: 15px;
    font-weight: 600;
    color: #1D9E75;
    margin: 16px 0 8px;
  }
  p {
    margin-bottom: 12px;
    color: #334155;
    font-size: 15px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  th {
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td {
    background: white;
    color: #0f172a;
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 14px;
  }
  tr:last-child td { border-bottom: none; }
  strong { color: #0f172a; font-weight: 600; }
  blockquote {
    border-left: 3px solid #f59e0b;
    background: #fffbeb;
    padding: 12px 16px;
    margin: 16px 0;
    color: #92400e;
    border-radius: 0 6px 6px 0;
    font-size: 14px;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }
  code {
    background: #f1f5f9;
    color: #1D9E75;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
  }
  a { color: #1D9E75; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .email-footer {
    padding: 16px 28px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
  }
  pre {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 13px;
    overflow-x: auto;
    color: #334155;
  }
`;

const logoSvg = `<svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M14,37 L12,45 L15.5,45 L16.5,37 Z" fill="#7A4E06"/>
  <path d="M31.5,37 L33.5,37 L36,45 L32.5,45 Z" fill="#7A4E06"/>
  <path d="M20,39 L19,45 L29,45 L28,39 Z" fill="#8B5E08"/>
  <path d="M10,18 Q6,28 8,35 Q14,42 24,42 Q34,42 40,35 Q42,28 38,18 Q32,14 24,14 Q16,14 10,18 Z" fill="#C87808"/>
  <path d="M10,19 Q7,28 9,34 Q12,39 16,41 Q12,36 10,29 Q8,22 11,20 Z" fill="#D48C10" opacity="0.75"/>
  <ellipse cx="24" cy="16.5" rx="15.5" ry="4.5" fill="#9A6208"/>
  <ellipse cx="24" cy="15.5" rx="14.5" ry="3.8" fill="#C88010"/>
  <ellipse cx="22" cy="14.5" rx="8" ry="2" fill="#F0A820" opacity="0.62"/>
  <ellipse cx="24" cy="17.8" rx="13" ry="3.2" fill="#6A4008"/>
  <ellipse cx="24" cy="17" rx="11" ry="2.2" fill="#1D9E75"/>
  <ellipse cx="24" cy="16.2" rx="10" ry="1.8" fill="#2dd4bf"/>
  <circle cx="24" cy="13.8" r="2" fill="#2dd4bf" opacity="0.7"/>
</svg>`;

async function sendMail({ to, subject, markdownBody }) {
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${EMAIL_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-header">
    ${logoSvg}
    <div class="logo-text">Geta<span>fix</span></div>
  </div>
  <div class="email-body">
    ${marked(markdownBody)}
  </div>
  <div class="email-footer">
    Getafix — Yatırım tavsiyesi değildir. Karar destek aracıdır.
  </div>
</div>
</body>
</html>`;

  return transporter.sendMail({
    from: '"Getafix" <' + process.env.EMAIL_FROM + '>',
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
  const loginUrl = `${process.env.FRONTEND_URL || 'https://getafix.com.tr'}/login`;
  const markdownBody = `# Getafix'e Hoş Geldiniz, ${name}!

Hesabınız oluşturuldu ve kullanıma hazır.

## Giriş Bilgileriniz

| | |
|---|---|
| **E-posta** | ${to} |
| **Geçici Şifre** | \`${tempPassword}\` |

## Sonraki Adım

[Giriş Yap → ${loginUrl}](${loginUrl})

Giriş yaptıktan sonra sistem sizi otomatik olarak şifre değiştirme sayfasına yönlendirecektir. Yeni şifreniz en az 8 karakter, 1 büyük harf ve 1 rakam içermelidir.

---

> **Güvenlik Notu:** Bu geçici şifreyi kimseyle paylaşmayın. İlk girişte yeni şifrenizi belirleyene kadar sisteme erişiminiz kısıtlıdır.

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

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const markdownBody = `# Şifre Sıfırlama

Merhaba ${name},

Getafix hesabınız için şifre sıfırlama talebinde bulundunuz.

Yeni şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın:

[Şifremi Sıfırla](${resetUrl})

> Bu bağlantı **1 saat** geçerlidir.

Eğer bu talebi siz yapmadıysanız bu emaili görmezden gelebilirsiniz.

---
Getafix — Yatırım tavsiyesi değildir. Karar destek aracıdır.`;

  return sendMail({
    to,
    subject: 'Getafix — Şifre Sıfırlama',
    markdownBody,
  });
}

async function sendActivationEmail({ to, name, activationUrl }) {
  const markdownBody = `# Getafix'e Hoş Geldiniz, ${name}!

Hesabınız oluşturuldu. Şifrenizi belirlemek için aşağıdaki butona tıklayın:

[Şifremi Belirle](${activationUrl})

> Bu bağlantı **7 gün** geçerlidir.

---
Getafix — Yatırım tavsiyesi değildir. Karar destek aracıdır.`;

  return sendMail({
    to,
    subject: 'Getafix — Hesabınız Hazır, Şifrenizi Belirleyin',
    markdownBody,
  });
}

module.exports = { sendForecastEmail, sendWelcomeEmail, sendErrorEmail, sendPasswordResetEmail, sendActivationEmail };

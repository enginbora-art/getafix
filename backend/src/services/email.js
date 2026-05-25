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

const emailHeader = `
<div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;
            padding-bottom:20px;border-bottom:1px solid #1e293b;">
  ${logoSvg}
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
              font-weight:500;font-size:20px;letter-spacing:-0.025em;color:#f8fafc;line-height:1;">
    Geta<span style="color:#2dd4bf;">fix</span>
  </div>
</div>`;

async function sendMail({ to, subject, markdownBody }) {
  const html = `<html><head><style>${EMAIL_CSS}</style></head>
    <body>${emailHeader}${marked(markdownBody)}</body></html>`;

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

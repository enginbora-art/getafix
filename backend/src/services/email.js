const { Resend } = require('resend');
const prisma = require('../lib/prisma');

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function markdownToHtml(markdown) {
  return markdown
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/```[\w]*\n[\s\S]*?```/g, '')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul]|<blockquote)(.+)/gm, '<p>$1</p>');
}

async function sendForecastEmail(content, market, date) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY yok, mail atlandı');
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { email: true },
    });

    if (!users.length) return;

    const resend = getResend();
    const dateStr = date.toLocaleDateString('tr-TR');
    const subject = `${market} Günlük Öneri — ${dateStr}`;
    const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         max-width: 720px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6; background: #fff; }
  h1 { color: #111; border-bottom: 2px solid #0d9488; padding-bottom: 8px; }
  h2 { color: #222; margin-top: 28px; }
  strong { color: #000; }
  blockquote { border-left: 4px solid #0d9488; background: #f0fdfa;
               padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid #eaeaea; margin: 24px 0; }
</style>
</head>
<body>
<p style="background:#0f172a;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:24px;">
  <strong style="color:#2dd4bf">GETAFIX</strong> — ${market} Raporu
</p>
${markdownToHtml(content)}
<hr>
<p style="color:#888;font-size:12px;">Getafix • Yatırım tavsiyesi değildir</p>
</body>
</html>`;

    const emails = users.map((u) => u.email);
    // Resend batch: max 50 per call
    for (let i = 0; i < emails.length; i += 50) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'getafix@yourdomain.com',
        to: emails.slice(i, i + 50),
        subject,
        html,
      });
    }
    console.log(`[email] ${market} raporu ${emails.length} adrese gönderildi`);
  } catch (err) {
    console.error(`[email] Gönderim hatası: ${err.message}`);
  }
}

async function sendErrorEmail(message, market) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const resend = getResend();
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { email: true },
    });
    if (!adminUsers.length) return;

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'getafix@yourdomain.com',
      to: adminUsers.map((u) => u.email),
      subject: `[HATA] ${market} Forecast — ${new Date().toLocaleDateString('tr-TR')}`,
      html: `<h2>Forecast Hatası</h2><pre>${message}</pre>`,
    });
  } catch (err) {
    console.error('[email] Admin hata maili gönderilemedi:', err.message);
  }
}

module.exports = { sendForecastEmail, sendErrorEmail };

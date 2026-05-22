async function generatePdf(markdownContent, meta = {}) {
  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');

  const html = buildHtml(markdownContent, meta);

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
}

function buildHtml(markdown, meta) {
  const { market = '', date, ticker = '' } = meta;
  const dateStr = date ? new Date(date).toLocaleDateString('tr-TR') : '';

  const body = markdown
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(\n(?!<li>))/g, '$1</ul>$2')
    .replace(/(?<!\n<\/ul>)\n<li>/g, '\n<ul><li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n---\n/g, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul2-6]|<blockquote|<hr)(.+)/gm, '<p>$1</p>');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
         color: #1a1a1a; line-height: 1.7; padding: 0; }
  .header { background: #0f172a; color: #fff; padding: 20px 24px; display: flex;
            justify-content: space-between; align-items: center; }
  .header-brand { font-size: 22px; font-weight: 700; color: #2dd4bf; }
  .header-meta { text-align: right; font-size: 13px; color: #94a3b8; }
  .header-ticker { font-size: 28px; font-weight: 800; color: #fff; }
  .content { padding: 24px; }
  h1 { color: #0f172a; border-bottom: 2px solid #0d9488; padding-bottom: 8px;
       margin: 24px 0 16px; font-size: 20px; }
  h2 { color: #1e293b; margin: 20px 0 12px; font-size: 16px; }
  h3 { color: #334155; margin: 16px 0 8px; font-size: 14px; }
  p { margin: 8px 0; font-size: 13px; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 4px 0; font-size: 13px; }
  strong { color: #0f172a; }
  blockquote { border-left: 3px solid #0d9488; background: #f0fdfa;
               padding: 10px 14px; margin: 12px 0; border-radius: 4px;
               font-size: 12px; color: #334155; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0;
            padding: 12px 24px; text-align: center; font-size: 11px; color: #64748b; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-brand">GETAFIX</div>
    <div class="header-meta">
      <div class="header-ticker">${ticker}</div>
      <div>${market} • ${dateStr}</div>
    </div>
  </div>
  <div class="content">${body}</div>
  <div class="footer">
    Getafix AI Forecast Platform — Bu rapor yatırım tavsiyesi değildir.
  </div>
</body>
</html>`;
}

module.exports = { generatePdf };

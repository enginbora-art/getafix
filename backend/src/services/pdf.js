const { marked } = require('marked');

const cauldronSvg = `<svg width="36" height="36" viewBox="0 0 48 48" fill="none">
  <path d="M14,37 L12,45 L15.5,45 L16.5,37 Z" fill="#7A4E06"/>
  <path d="M31.5,37 L33.5,37 L36,45 L32.5,45 Z" fill="#7A4E06"/>
  <path d="M20,39 L19,45 L29,45 L28,39 Z" fill="#8B5E08"/>
  <path d="M10,18 Q6,28 8,35 Q14,42 24,42 Q34,42 40,35 Q42,28 38,18 Q32,14 24,14 Q16,14 10,18 Z" fill="#C87808"/>
  <path d="M10,19 Q7,28 9,34 Q12,39 16,41 Q12,36 10,29 Q8,22 11,20 Z" fill="#D48C10" opacity="0.75"/>
  <path d="M12,17 Q9,24 11,30 Q13,36 17,39 Q13,32 12,25 Q10,19 13,18 Z" fill="#F0A820" opacity="0.5"/>
  <ellipse cx="24" cy="16.5" rx="15.5" ry="4.5" fill="#9A6208"/>
  <ellipse cx="24" cy="15.5" rx="14.5" ry="3.8" fill="#C88010"/>
  <ellipse cx="22" cy="14.5" rx="8" ry="2" fill="#F0A820" opacity="0.62"/>
  <ellipse cx="24" cy="17.8" rx="13" ry="3.2" fill="#6A4008"/>
  <ellipse cx="24" cy="17" rx="11" ry="2.2" fill="#1D9E75"/>
  <ellipse cx="24" cy="16.2" rx="10" ry="1.8" fill="#2dd4bf"/>
  <circle cx="24" cy="13.8" r="2" fill="#2dd4bf" opacity="0.7"/>
</svg>`;

const BIAS_CONFIG = {
  AL:    { bg: '#dcfce7', border: '#16a34a', color: '#15803d', label: '⚡ KARAR: AL' },
  SAT:   { bg: '#fee2e2', border: '#dc2626', color: '#b91c1c', label: '⚡ KARAR: SAT' },
  BEKLE: { bg: '#fef9c3', border: '#ca8a04', color: '#a16207', label: '⚡ KARAR: BEKLE' },
};

function parseBias(content) {
  const m = content?.match(/##\s*⚡\s*KARAR:\s*(AL|SAT|BEKLE)/i);
  return m?.[1]?.toUpperCase() || null;
}

function parseMetrics(content) {
  // Match | **Key** | Value | rows from the first section (before first ---)
  const firstSection = content.split(/\n---\n/)[0];
  const rows = [];
  const re = /\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|\n]+)\s*\|/g;
  let m;
  while ((m = re.exec(firstSection)) !== null) {
    const key = m[1].trim();
    const val = m[2].trim();
    if (key && val) rows.push([key, val]);
  }
  return rows;
}

function stripForPdf(content) {
  return content
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/```kap[\s\S]*?```/g, '')
    // Remove KARAR section (heading + table + optional blockquote) up to first ---
    .replace(/##\s*⚡[^\n]*\n[\s\S]*?\n---\n/, '\n');
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

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
      margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-size:9px;color:#94a3b8;padding:0 15mm;display:flex;justify-content:space-between;border-top:0.5px solid #e2e8f0;padding-top:4px;font-family:Arial,sans-serif"><span>Getafix — Yatırım tavsiyesi değildir. Karar destek aracıdır.</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });

    return pdfBuffer;
  } finally {
    if (browser) await browser.close();
  }
}

function buildHtml(content, meta) {
  const { market = '', date, ticker = '' } = meta;
  const dateStr = formatDate(date);
  const marketLabel = market === 'BIST' ? 'BIST Analiz Raporu' : market === 'US' ? 'US Analiz Raporu' : 'Analiz Raporu';

  const bias = parseBias(content);
  const biasCfg = BIAS_CONFIG[bias] || { bg: '#f8fafc', border: '#cbd5e1', color: '#475569', label: '⚡ KARAR' };
  const metrics = parseMetrics(content);
  const bodyHtml = marked(stripForPdf(content));

  const metricsHtml = metrics.length > 0
    ? `<table class="metrics-table">${
        metrics.map(([k, v]) => `<tr><td class="metric-key">${k}</td><td class="metric-val">${v}</td></tr>`).join('')
      }</table>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.6; background: #fff; }

  .header { background: #0f172a; padding: 18px 20px 0; border-bottom: 3px solid #2dd4bf; }
  .header-top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
  .brand-name span { color: #2dd4bf; }
  .report-type { text-align: right; line-height: 1.4; }
  .report-type strong { display: block; font-size: 16px; color: #e2e8f0; font-weight: 700; }
  .report-type em { font-size: 12px; color: #94a3b8; font-style: normal; }

  .meta-band { background: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 9px 20px; display: flex; justify-content: space-between; font-size: 12px; color: #475569; }
  .meta-band strong { color: #0f172a; }

  .karar-box { margin: 18px 20px; border-radius: 10px; border: 1.5px solid ${biasCfg.border}; background: ${biasCfg.bg}; overflow: hidden; }
  .karar-header { padding: 12px 18px; border-bottom: 1px solid ${biasCfg.border}; }
  .karar-title { font-size: 18px; font-weight: 800; color: ${biasCfg.color}; letter-spacing: 0.4px; }
  .metrics-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .metrics-table tr:nth-child(even) { background: rgba(0,0,0,0.03); }
  .metric-key { padding: 7px 18px; color: #475569; font-weight: 500; width: 55%; border-bottom: 1px solid rgba(0,0,0,0.05); }
  .metric-val { padding: 7px 18px; color: #0f172a; font-weight: 700; border-bottom: 1px solid rgba(0,0,0,0.05); }

  .content { padding: 8px 20px 24px; }
  .content h1 { font-size: 19px; font-weight: 800; color: #0f172a; margin: 22px 0 10px; padding-bottom: 7px; border-bottom: 2px solid #e2e8f0; }
  .content h2 { font-size: 13px; font-weight: 700; color: #1D9E75; margin: 18px 0 7px; text-transform: uppercase; letter-spacing: 0.4px; }
  .content h3 { font-size: 13px; font-weight: 600; color: #334155; margin: 14px 0 6px; }
  .content p { font-size: 13px; color: #334155; margin: 6px 0; line-height: 1.65; }
  .content ul, .content ol { padding-left: 20px; margin: 8px 0; }
  .content li { font-size: 13px; color: #334155; margin: 3px 0; }
  .content strong { color: #0f172a; font-weight: 700; }
  .content em { color: #475569; }
  .content blockquote { border-left: 3px solid #f59e0b; background: #fffbeb; padding: 8px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; font-size: 12px; color: #78350f; font-style: italic; }
  .content hr { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }
  .content table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 12px 0; }
  .content table th { background: #f1f5f9; padding: 7px 12px; text-align: left; font-weight: 600; color: #0f172a; border: 1px solid #e2e8f0; }
  .content table td { padding: 7px 12px; border: 1px solid #e2e8f0; color: #334155; }
  .content table tr:nth-child(even) td { background: #f8fafc; }
  .content code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 11px; font-family: 'Courier New', monospace; color: #0f172a; }
  .content pre { background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 10px 0; overflow: hidden; }
  .content pre code { background: none; padding: 0; font-size: 11.5px; }
</style>
</head>
<body>

  <div class="header">
    <div class="header-top">
      <div class="brand">
        ${cauldronSvg}
        <span class="brand-name">Geta<span>fix</span></span>
      </div>
      <div class="report-type">
        ${ticker ? `<strong>${ticker}</strong>` : ''}
        <em>${marketLabel}</em>
      </div>
    </div>
  </div>

  <div class="meta-band">
    <span>Rapor Tarihi: <strong>${dateStr || '—'}</strong></span>
    ${ticker
      ? `<span>Ticker: <strong>${ticker}</strong> &nbsp;•&nbsp; Piyasa: <strong>${market}</strong></span>`
      : `<span>Piyasa: <strong>${market}</strong></span>`
    }
  </div>

  ${bias ? `
  <div class="karar-box">
    <div class="karar-header">
      <div class="karar-title">${biasCfg.label}</div>
    </div>
    ${metricsHtml}
  </div>` : ''}

  <div class="content">
    ${bodyHtml}
  </div>

</body>
</html>`;
}

module.exports = { generatePdf };

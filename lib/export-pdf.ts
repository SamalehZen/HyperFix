'use client';

import { marked } from 'marked';

export interface PdfExportOptions {
  content: string;
  modelName?: string;
  title?: string;
}

const LOGO_SVG = `<svg viewBox="410 260 380 375" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M 593.85 445.59 Q 599.96 442.96 603.41 437.40 Q 628.58 396.82 643.10 374.10 Q 648.95 364.94 650.03 363.03 C 652.80 358.13 656.14 353.64 659.66 348.01 Q 685.84 306.13 704.24 277.53 C 710.45 267.87 722.16 265.20 731.45 272.39 Q 733.88 274.27 737.06 279.49 Q 746.51 295.02 774.00 337.83 C 779.62 346.58 781.66 352.13 776.01 361.01 Q 761.80 383.34 728.28 436.54 C 722.64 445.50 722.41 450.90 728.07 459.69 Q 737.16 473.78 774.10 531.97 Q 778.92 539.57 779.25 542.64 Q 779.87 548.56 776.24 554.48 C 763.95 574.53 749.55 596.95 736.36 618.35 Q 731.06 626.94 721.20 627.63 C 712.86 628.21 707.46 623.80 703.21 617.05 Q 678.41 577.68 668.20 561.62 Q 661.93 551.74 661.37 549.59 Q 659.63 542.79 663.57 536.33 Q 679.53 510.22 703.03 474.01 C 706.20 469.13 707.04 466.44 706.20 461.09 C 705.31 455.43 700.53 450.87 695.14 449.62 Q 690.87 448.63 684.75 448.67 Q 648.06 448.88 609.50 448.60 Q 600.88 448.54 594.57 455.09 C 591.21 458.58 587.48 465.21 583.81 471.06 Q 543.14 535.88 503.77 598.26 Q 501.21 602.32 494.95 612.63 Q 488.99 622.43 485.96 624.35 C 476.99 630.05 465.12 627.99 459.30 618.69 Q 440.31 588.34 421.09 558.03 Q 416.63 551.00 416.21 548.18 C 415.41 542.80 416.55 539.23 419.78 534.22 Q 428.83 520.18 468.93 456.54 Q 474.30 448.02 468.62 439.05 Q 445.18 401.98 420.88 363.82 Q 416.80 357.41 416.12 353.73 Q 415.05 347.99 418.24 342.90 Q 457.56 280.13 459.46 277.23 C 467.22 265.36 483.19 265.34 490.80 277.48 Q 491.14 278.02 501.55 294.72 Q 501.98 295.41 532.37 343.12 Q 535.35 347.80 534.54 353.04 Q 534.02 356.39 530.25 362.36 Q 511.36 392.23 491.76 423.54 Q 485.58 433.40 493.01 442.01 C 496.72 446.31 501.93 447.01 507.80 447.00 Q 579.00 446.91 583.83 447.06 Q 590.01 447.24 593.85 445.59 Z" fill="#111111"/></svg>`;

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
};

const extractTitle = (markdown: string): string => {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const h2 = markdown.match(/^##\s+(.+)$/m);
  if (h2) return h2[1].trim();
  const bold = markdown.match(/\*\*([^*]+)\*\*/);
  if (bold) return bold[1].trim();
  const first = markdown.split('\n').find((l) => l.trim().length > 10);
  if (first) {
    const c = first.replace(/[#*_`]/g, '').trim();
    return c.length > 60 ? c.slice(0, 60) + '...' : c;
  }
  return 'HyperFix Response';
};

const formatPdfDate = (date: Date): string => {
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const renderMarkdownToHtml = (markdown: string): string => {
  marked.setOptions({
    gfm: true,
    breaks: false,
  });
  return marked.parse(markdown) as string;
};

const applyInlineStyles = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const styleMap: Record<string, string> = {
    h1: 'font-size:26px;font-weight:700;color:#111111;margin:24px 0 12px;line-height:1.25;padding-bottom:8px;border-bottom:1px solid #d1d5db;',
    h2: 'font-size:22px;font-weight:700;color:#111111;margin:24px 0 12px;line-height:1.25;padding-bottom:6px;border-bottom:1px solid #e5e7eb;',
    h3: 'font-size:18px;font-weight:700;color:#111111;margin:20px 0 10px;line-height:1.25;',
    h4: 'font-size:16px;font-weight:700;color:#111111;margin:18px 0 8px;line-height:1.25;',
    h5: 'font-size:15px;font-weight:700;color:#111111;margin:18px 0 8px;',
    h6: 'font-size:14px;font-weight:700;color:#555555;margin:18px 0 8px;',
    p: 'margin:0 0 14px;line-height:1.75;color:#111111;font-size:15px;',
    strong: 'font-weight:700;color:#111111;',
    em: 'font-style:italic;',
    a: 'color:#111111;text-decoration:underline;text-underline-offset:2px;',
    ul: 'margin:0 0 14px;padding-left:2em;color:#111111;',
    ol: 'margin:0 0 14px;padding-left:2em;color:#111111;',
    li: 'margin:4px 0;line-height:1.6;color:#111111;',
    blockquote: 'margin:0 0 14px;padding:0 1em;color:#333333;border-left:4px solid #111111;',
    pre: 'margin:0 0 14px;padding:14px 16px;white-space:pre-wrap;word-wrap:break-word;background:#1e1e2e;color:#f8f8f2;border-radius:8px;line-height:1.5;overflow:visible;',
    table: 'width:100%;border-collapse:collapse;border-spacing:0;margin:0 0 14px;',
    th: 'font-weight:700;color:#111111;background:#f3f4f6;padding:8px 12px;border:1px solid #d1d5db;text-align:left;',
    td: 'padding:8px 12px;border:1px solid #d1d5db;color:#111111;vertical-align:top;',
    hr: 'height:1px;border:0;background:#d1d5db;margin:20px 0;',
    img: 'max-width:100%;height:auto;border-radius:8px;',
  };

  for (const [tag, style] of Object.entries(styleMap)) {
    div.querySelectorAll(tag).forEach((el) => {
      (el as HTMLElement).style.cssText += style;
    });
  }

  div.querySelectorAll('code').forEach((el) => {
    const parent = el.parentElement;
    if (parent && parent.tagName.toLowerCase() === 'pre') {
      (el as HTMLElement).style.cssText =
        'background:transparent;color:inherit;padding:0;border-radius:0;font-size:13px;white-space:pre-wrap;font-family:SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;';
    } else {
      (el as HTMLElement).style.cssText =
        'font-family:SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;font-size:0.9em;background:#f3f4f6;color:#111111;border-radius:4px;padding:0.2em 0.4em;';
    }
  });

  div.querySelectorAll('tbody').forEach((tbody) => {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, index) => {
      if (index % 2 === 1) {
        (row as HTMLElement).style.backgroundColor = '#f9fafb';
      }
    });
  });

  div.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    (el as HTMLInputElement).style.marginRight = '6px';
  });

  return div.innerHTML;
};

const buildPdfHtml = (opts: {
  content: string;
  modelName: string;
  title: string;
  date: string;
}): string => {
  const rawHtml = renderMarkdownToHtml(opts.content);
  const bodyHtml = applyInlineStyles(rawHtml);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #fff; color: #111; line-height: 1.6; -webkit-font-smoothing: antialiased; }
</style>
</head>
<body>
<div id="pdf-content" style="width:794px;margin:0 auto;padding:48px 52px 40px;background:#ffffff;">

  <div id="pdf-header" style="border-bottom:2px solid #111111;padding-bottom:16px;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:10px;">
      ${LOGO_SVG}
      <div>
        <div style="font-size:22px;font-weight:700;color:#111111;line-height:1;">HyperFix</div>
      </div>
    </div>
    <div style="margin-top:6px;font-size:11px;color:#555555;">Model: ${escapeHtml(opts.modelName)} • Date: ${escapeHtml(opts.date)}</div>
  </div>

  <div style="font-size:15px;line-height:1.75;color:#111111;word-wrap:break-word;">
    ${bodyHtml}
  </div>

  <div style="margin-top:32px;padding-top:14px;border-top:2px solid #111111;display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#555555;">
    <span><strong style="color:#111111;">HyperFix</strong> — La fixation, notre raison d\u2019être.</span>
    <span>\u00a9 ${new Date().getFullYear()} HyperFix</span>
  </div>

</div>
</body>
</html>`;
};

const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const generatePdfFromMarkdown = async (options: PdfExportOptions): Promise<void> => {
  const { content, modelName = 'Gemini', title: customTitle } = options;

  if (typeof window === 'undefined') {
    throw new Error('PDF generation is only available in browser');
  }

  const title = customTitle || extractTitle(content);
  const date = formatPdfDate(new Date());
  const filename = `hyperfix-${generateSlug(title)}.pdf`;

  let html2pdf: any;
  try {
    const mod = await import('html2pdf.js');
    html2pdf = mod.default || mod;
  } catch (e) {
    throw new Error(`Import html2pdf failed: ${e}`);
  }

  const fullHtml = buildPdfHtml({ content, modelName, title, date });

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  document.body.appendChild(container);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:900px;height:3000px;border:none;background:#fff;';
  container.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(container);
    throw new Error('Cannot access iframe document');
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  await new Promise((r) => setTimeout(r, 300));

  const pdfContent = iframeDoc.querySelector('#pdf-content');
  if (!pdfContent) {
    document.body.removeChild(container);
    throw new Error('Cannot find #pdf-content element');
  }

  try {
    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 900,
        },
        jsPDF: {
          unit: 'pt',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['tr', 'pre', 'blockquote', '#pdf-header'],
        },
      })
      .from(pdfContent)
      .save();
  } finally {
    document.body.removeChild(container);
  }
};

export const downloadResponseAsPdf = async (
  markdownContent: string,
  modelName?: string,
  customTitle?: string,
): Promise<void> => {
  return generatePdfFromMarkdown({
    content: markdownContent,
    modelName,
    title: customTitle,
  });
};

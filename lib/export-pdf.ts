'use client';

export interface PdfExportOptions {
  content: string;
  modelName?: string;
  title?: string;
}

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
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();

  const h2Match = markdown.match(/^##\s+(.+)$/m);
  if (h2Match) return h2Match[1].trim();

  const boldMatch = markdown.match(/\*\*([^*]+)\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  const firstLine = markdown.split('\n').find((line) => line.trim().length > 10);
  if (firstLine) {
    const cleaned = firstLine.replace(/[#*_`]/g, '').trim();
    return cleaned.length > 60 ? cleaned.slice(0, 60) + '...' : cleaned;
  }

  return 'HyperFix Response';
};

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const markdownToHtml = (markdown: string): string => {
  let html = markdown;

  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre style="background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 14px; overflow-x: auto; font-family: Consolas, Monaco, monospace; font-size: 13px; line-height: 1.5; margin: 14px 0; color: #333;"><code>${escapeHtml(code.trim())}</code></pre>`);
    return `__CODE_BLOCK_${index}__`;
  });

  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size: 15px; font-weight: 600; color: #222; margin: 18px 0 8px 0;">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size: 17px; font-weight: 600; color: #222; margin: 20px 0 10px 0;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size: 19px; font-weight: 700; color: #111; margin: 24px 0 12px 0;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '');

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight: 600; color: #111;">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code style="background-color: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: Consolas, monospace; font-size: 14px; color: #c7254e;">$1</code>');

  html = html.replace(/^>\s*(.+)$/gm, '<blockquote style="border-left: 4px solid #6366f1; padding: 10px 16px; margin: 16px 0; background-color: #f9fafb; color: #555;">$1</blockquote>');

  html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">');

  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listType = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)[-*•]\s+(.+)$/);
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);

    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) processedLines.push('</ul>');
        inList = true;
        listType = 'ul';
        processedLines.push('<ul style="margin: 14px 0; padding-left: 24px; color: #333;">');
      }
      processedLines.push(`<li style="margin: 8px 0; line-height: 1.6;">${bulletMatch[2]}</li>`);
    } else if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) processedLines.push('</ol>');
        inList = true;
        listType = 'ol';
        processedLines.push('<ol style="margin: 14px 0; padding-left: 24px; color: #333;">');
      }
      processedLines.push(`<li style="margin: 8px 0; line-height: 1.6;">${numberedMatch[3]}</li>`);
    } else {
      if (inList && line.trim() === '') {
        continue;
      }
      if (inList && !line.match(/^\s+/)) {
        processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = '';
      }

      if (line.trim() === '') {
        processedLines.push('');
      } else if (line.startsWith('__CODE_BLOCK_')) {
        processedLines.push(line);
      } else if (!line.startsWith('<')) {
        processedLines.push(`<p style="margin: 12px 0; line-height: 1.7; color: #333; font-size: 15px;">${line}</p>`);
      } else {
        processedLines.push(line);
      }
    }
  }

  if (inList) {
    processedLines.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  html = processedLines.join('\n');

  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block);
  });

  return html;
};

export const generatePdfFromMarkdown = async (options: PdfExportOptions): Promise<void> => {
  const { content, modelName = 'Gemini', title: customTitle } = options;

  if (typeof window === 'undefined') {
    throw new Error('PDF generation is only available in browser');
  }

  const title = customTitle || extractTitle(content);
  const date = new Date().toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const htmlContent = markdownToHtml(content);

  let html2pdf: any;
  try {
    const module = await import('html2pdf.js');
    html2pdf = module.default || module;
  } catch (importError) {
    throw new Error(`Import html2pdf échoué: ${importError}`);
  }

  if (!html2pdf) {
    throw new Error('html2pdf module non chargé');
  }

  const wrapper = document.createElement('div');
  wrapper.id = 'pdf-export-wrapper';
  wrapper.style.cssText = 'position: fixed; left: -10000px; top: 0; z-index: -9999;';
  
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width: 800px; height: 2000px; border: none;';
  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(wrapper);
    throw new Error('Impossible de créer le document iframe');
  }

  iframeDoc.open();
  iframeDoc.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #333;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div style="padding: 40px; background: #fff; color: #333;">
    
    <div style="border-bottom: 2px solid #e0e0e0; padding-bottom: 18px; margin-bottom: 28px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <svg width="28" height="28" viewBox="0 0 910 934" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M647.664 197.775C569.13 189.049 525.5 145.419 516.774 66.8849C508.048 145.419 464.418 189.049 385.884 197.775C464.418 206.501 508.048 250.131 516.774 328.665C525.5 250.131 569.13 206.501 647.664 197.775Z" stroke="#6366f1" stroke-width="8" stroke-linejoin="round"/>
          <path d="M516.774 304.217C510.299 275.491 498.208 252.087 480.335 234.214C462.462 216.341 439.058 204.251 410.333 197.775C439.059 191.3 462.462 179.209 480.335 161.336C498.208 143.463 510.299 120.06 516.774 91.334C523.25 120.059 535.34 143.463 553.213 161.336C571.086 179.209 594.49 191.3 623.216 197.775C594.49 204.251 571.086 216.341 553.213 234.214C535.34 252.087 523.25 275.491 516.774 304.217Z" fill="#6366f1" stroke="#6366f1" stroke-width="8" stroke-linejoin="round"/>
          <path d="M857.5 508.116C763.259 497.644 710.903 445.288 700.432 351.047C689.961 445.288 637.605 497.644 543.364 508.116C637.605 518.587 689.961 570.943 700.432 665.184C710.903 570.943 763.259 518.587 857.5 508.116Z" stroke="#6366f1" stroke-width="20" stroke-linejoin="round"/>
          <path d="M700.432 615.957C691.848 589.05 678.575 566.357 660.383 548.165C642.191 529.973 619.499 516.7 592.593 508.116C619.499 499.533 642.191 486.258 660.383 468.066C678.575 449.874 691.848 427.181 700.432 400.274C709.015 427.181 722.289 449.874 740.481 468.066C758.673 486.258 781.365 499.533 808.271 508.116C781.365 516.7 758.673 529.973 740.481 548.165C722.289 566.357 709.015 589.05 700.432 615.957Z" stroke="#6366f1" stroke-width="20" stroke-linejoin="round"/>
          <path d="M889.949 121.237C831.049 114.692 798.326 81.9698 791.782 23.0692C785.237 81.9698 752.515 114.692 693.614 121.237C752.515 127.781 785.237 160.504 791.782 219.404C798.326 160.504 831.049 127.781 889.949 121.237Z" stroke="#6366f1" stroke-width="8" stroke-linejoin="round"/>
          <path d="M791.782 196.795C786.697 176.937 777.869 160.567 765.16 147.858C752.452 135.15 736.082 126.322 716.226 121.237C736.082 116.152 752.452 107.324 765.16 94.6152C777.869 81.9065 786.697 65.5368 791.782 45.6797C796.867 65.5367 805.695 81.9066 818.403 94.6152C831.112 107.324 847.481 116.152 867.338 121.237C847.481 126.322 831.112 135.15 818.403 147.858C805.694 160.567 796.867 176.937 791.782 196.795Z" fill="#6366f1" stroke="#6366f1" stroke-width="8" stroke-linejoin="round"/>
          <path d="M760.632 764.337C720.719 814.616 669.835 855.1 611.872 882.692C553.91 910.285 490.404 924.255 426.213 923.533C362.022 922.812 298.846 907.419 241.518 878.531C184.19 849.643 134.228 808.026 95.4548 756.863C56.6815 705.7 30.1238 646.346 17.8129 583.343C5.50206 520.339 7.76432 455.354 24.4266 393.359C41.0889 331.364 71.7099 274.001 113.947 225.658C156.184 177.315 208.919 139.273 268.117 114.442" stroke="#6366f1" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span style="font-size: 24px; font-weight: 700; color: #111;">HyperFix</span>
      </div>
      <div style="font-size: 13px; color: #666;">
        Model: ${modelName} • Date: ${date}
      </div>
    </div>

    <h1 style="font-size: 26px; font-weight: 700; color: #111; margin-bottom: 28px; line-height: 1.3;">
      ${title}
    </h1>

    <div style="font-size: 15px; color: #333;">
      ${htmlContent}
    </div>

    <div style="margin-top: 50px; padding-top: 18px; border-top: 2px solid #e0e0e0; font-size: 11px; color: #999; text-align: center;">
      Generer par HyperFix • © ${new Date().getFullYear()} HyperFix
    </div>
  </div>
</body>
</html>
  `);
  iframeDoc.close();

  await new Promise(resolve => setTimeout(resolve, 100));

  const filename = `hyperfix-${generateSlug(title)}.pdf`;

  try {
    await html2pdf()
      .set({
        margin: [12, 12, 16, 12],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          backgroundColor: '#ffffff',
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
      })
      .from(iframeDoc.body)
      .save();
  } finally {
    document.body.removeChild(wrapper);
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

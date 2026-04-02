'use client';

import React from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { HyperLogo } from '@/components/logos/hyper-logo';

export interface PdfExportOptions {
  content: string;
  modelName?: string;
  title?: string;
}

const h = React.createElement;

const pdfStyles = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111111;
    font-family: Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  body {
    width: 794px;
    margin: 0 auto;
  }

  #pdf-root {
    width: 100%;
  }

  .pdf-shell {
    width: 100%;
    padding: 48px 52px 40px;
    background: #ffffff;
    color: #111111;
  }

  .pdf-header {
    border-bottom: 2px solid #111111;
    padding-bottom: 18px;
    margin-bottom: 28px;
  }

  .pdf-brand-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .pdf-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pdf-brand-name {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.1;
    color: #111111;
  }

  .pdf-brand-tagline {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #4b5563;
  }

  .pdf-badge {
    border: 1px solid #111111;
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    color: #111111;
    background: #ffffff;
  }

  .pdf-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .pdf-meta-card {
    border: 1px solid #d1d5db;
    border-radius: 10px;
    background: #f9fafb;
    padding: 10px 12px;
  }

  .pdf-meta-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .pdf-meta-value {
    margin-top: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #111111;
    word-break: break-word;
  }

  .pdf-title-block {
    margin-bottom: 26px;
    padding-bottom: 18px;
    border-bottom: 1px solid #e5e7eb;
  }

  .pdf-title-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
    margin-bottom: 10px;
  }

  .pdf-title {
    margin: 0;
    font-size: 30px;
    line-height: 1.2;
    font-weight: 800;
    color: #111111;
  }

  .pdf-title-subtitle {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.7;
    color: #374151;
  }

  .pdf-content {
    font-size: 15px;
    line-height: 1.75;
    color: #111111;
  }

  .pdf-content > :first-child {
    margin-top: 0;
  }

  .pdf-content h1,
  .pdf-content h2,
  .pdf-content h3,
  .pdf-content h4,
  .pdf-content h5,
  .pdf-content h6 {
    margin: 28px 0 12px;
    color: #111111;
    line-height: 1.3;
    font-weight: 800;
    break-after: avoid-page;
  }

  .pdf-content h1 { font-size: 28px; }
  .pdf-content h2 { font-size: 24px; }
  .pdf-content h3 { font-size: 20px; }
  .pdf-content h4 { font-size: 17px; }
  .pdf-content h5 { font-size: 15px; }
  .pdf-content h6 { font-size: 14px; }

  .pdf-content p,
  .pdf-content ul,
  .pdf-content ol,
  .pdf-content blockquote,
  .pdf-content pre,
  .pdf-content hr,
  .pdf-table-wrapper {
    margin: 0 0 16px;
  }

  .pdf-content p,
  .pdf-content li,
  .pdf-content td,
  .pdf-content th {
    color: #111111;
  }

  .pdf-content ul,
  .pdf-content ol {
    padding-left: 24px;
  }

  .pdf-content li + li {
    margin-top: 6px;
  }

  .pdf-content ul ul,
  .pdf-content ul ol,
  .pdf-content ol ul,
  .pdf-content ol ol {
    margin-top: 8px;
    margin-bottom: 0;
  }

  .pdf-blockquote {
    border-left: 4px solid #111111;
    background: #f9fafb;
    border-radius: 0 10px 10px 0;
    padding: 14px 16px;
    color: #1f2937;
    font-style: italic;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .pdf-blockquote p:last-child {
    margin-bottom: 0;
  }

  .pdf-link {
    color: #111111;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    word-break: break-word;
  }

  .pdf-link:visited {
    color: #111111;
  }

  .pdf-code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.92em;
    background: #f3f4f6;
    color: #111111;
    border-radius: 4px;
    padding: 0.15em 0.45em;
    word-break: break-word;
  }

  .pdf-pre {
    background: #111827;
    color: #f9fafb;
    border-radius: 10px;
    padding: 16px 18px;
    overflow-x: visible;
    white-space: pre-wrap;
    word-break: break-word;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .pdf-pre .pdf-code,
  .pdf-pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    border-radius: 0;
    white-space: pre-wrap;
  }

  .pdf-hr {
    border: 0;
    border-top: 1px solid #d1d5db;
    margin: 24px 0;
  }

  .pdf-image {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
  }

  .pdf-table-wrapper {
    width: 100%;
    overflow: visible;
    break-inside: auto;
    page-break-inside: auto;
  }

  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    border: 1px solid #d1d5db;
    border-radius: 12px;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.55;
  }

  .pdf-thead {
    display: table-header-group;
    background: #f3f4f6;
  }

  .pdf-tbody {
    display: table-row-group;
  }

  .pdf-tr {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  .pdf-th,
  .pdf-td {
    border: 1px solid #d1d5db;
    padding: 10px 12px;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .pdf-th {
    background: #f3f4f6;
    color: #111111;
    font-weight: 800;
  }

  .pdf-table tbody tr:nth-child(even) {
    background: #fafafa;
  }

  .pdf-table p,
  .pdf-table ul,
  .pdf-table ol,
  .pdf-table blockquote,
  .pdf-table pre {
    margin-bottom: 10px;
  }

  .pdf-table p:last-child,
  .pdf-table ul:last-child,
  .pdf-table ol:last-child,
  .pdf-table blockquote:last-child,
  .pdf-table pre:last-child {
    margin-bottom: 0;
  }

  .pdf-table th[align='left'],
  .pdf-table td[align='left'] {
    text-align: left;
  }

  .pdf-table th[align='center'],
  .pdf-table td[align='center'] {
    text-align: center;
  }

  .pdf-table th[align='right'],
  .pdf-table td[align='right'] {
    text-align: right;
  }

  .pdf-content input[type='checkbox'] {
    width: 13px;
    height: 13px;
    margin-right: 8px;
    accent-color: #111111;
    transform: translateY(1px);
  }

  .pdf-content .task-list-item {
    list-style: none;
    margin-left: -20px;
  }

  .pdf-footer {
    margin-top: 34px;
    padding-top: 16px;
    border-top: 2px solid #111111;
  }

  .pdf-footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 11px;
    color: #4b5563;
  }

  .pdf-footer strong {
    color: #111111;
  }
`;

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

const stripLeadingTitle = (markdown: string, title: string): string => {
  const trimmed = markdown.trimStart();
  const normalizedTitle = title.trim();
  const patterns = [/^#\s+(.+)\s*(?:\n|$)/, /^##\s+(.+)\s*(?:\n|$)/, /^\*\*([^*]+)\*\*\s*(?:\n|$)/];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1].trim() === normalizedTitle) {
      return trimmed.slice(match[0].length).trimStart();
    }
  }

  return trimmed;
};

const formatPdfDate = (date: Date): string => {
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const createMetaCard = (label: string, value: string, key: string) => {
  return h('div', { className: 'pdf-meta-card', key }, [
    h('div', { className: 'pdf-meta-label', key: `${key}-label` }, label),
    h('div', { className: 'pdf-meta-value', key: `${key}-value` }, value),
  ]);
};

const pdfMarkdownComponents: Components = {
  table({ children }) {
    return h('div', { className: 'pdf-table-wrapper' }, h('table', { className: 'pdf-table' }, children));
  },
  thead({ children }) {
    return h('thead', { className: 'pdf-thead' }, children);
  },
  tbody({ children }) {
    return h('tbody', { className: 'pdf-tbody' }, children);
  },
  tr({ children }) {
    return h('tr', { className: 'pdf-tr' }, children);
  },
  th({ children, node: _node, className, ...props }: any) {
    return h('th', { ...props, className: ['pdf-th', className].filter(Boolean).join(' ') }, children);
  },
  td({ children, node: _node, className, ...props }: any) {
    return h('td', { ...props, className: ['pdf-td', className].filter(Boolean).join(' ') }, children);
  },
  a({ children, node: _node, href, className, ...props }: any) {
    return h(
      'a',
      {
        ...props,
        href: href || '#',
        target: '_blank',
        rel: 'noreferrer',
        className: ['pdf-link', className].filter(Boolean).join(' '),
      },
      children,
    );
  },
  blockquote({ children }) {
    return h('blockquote', { className: 'pdf-blockquote' }, children);
  },
  pre({ children }) {
    return h('pre', { className: 'pdf-pre' }, children);
  },
  code({ children, node: _node, className, ...props }: any) {
    return h('code', { ...props, className: ['pdf-code', className].filter(Boolean).join(' ') }, children);
  },
  hr() {
    return h('hr', { className: 'pdf-hr' });
  },
  img({ node: _node, className, ...props }: any) {
    return h('img', { ...props, className: ['pdf-image', className].filter(Boolean).join(' ') });
  },
};

const buildPdfDocument = ({
  content,
  modelName,
  title,
  date,
}: {
  content: string;
  modelName: string;
  title: string;
  date: string;
}) => {
  const bodyContent = stripLeadingTitle(content, title);

  return h('div', { className: 'pdf-shell' }, [
    h('header', { className: 'pdf-header', key: 'header' }, [
      h('div', { className: 'pdf-brand-row', key: 'brand-row' }, [
        h('div', { className: 'pdf-brand', key: 'brand' }, [
          h(HyperLogo, { width: 28, height: 28, color: '#111111', key: 'logo' }),
          h('div', { key: 'brand-copy' }, [
            h('div', { className: 'pdf-brand-name', key: 'brand-name' }, 'HyperFix'),
            h('div', { className: 'pdf-brand-tagline', key: 'brand-tagline' }, 'La fixation — notre raison d’être.'),
          ]),
        ]),
        h('div', { className: 'pdf-badge', key: 'badge' }, 'PDF export'),
      ]),
      h('div', { className: 'pdf-meta-grid', key: 'meta-grid' }, [
        createMetaCard('Titre', title, 'title'),
        createMetaCard('Modèle', modelName, 'model'),
        createMetaCard('Exporté le', date, 'date'),
      ]),
    ]),
    h('section', { className: 'pdf-title-block', key: 'title-block' }, [
      h('div', { className: 'pdf-title-label', key: 'title-label' }, 'Contenu de la discussion'),
      h('h1', { className: 'pdf-title', key: 'title' }, title),
      h(
        'p',
        { className: 'pdf-title-subtitle', key: 'title-subtitle' },
        'Export structuré pour impression et partage, avec rendu Markdown enrichi, tableaux GFM, blocs de code et typographie noire à forte lisibilité.',
      ),
    ]),
    h(
      'main',
      { className: 'pdf-content', key: 'content' },
      h(ReactMarkdown, { remarkPlugins: [remarkGfm], components: pdfMarkdownComponents }, bodyContent),
    ),
    h('footer', { className: 'pdf-footer', key: 'footer' }, [
      h('div', { className: 'pdf-footer-row', key: 'footer-row' }, [
        h('span', { key: 'footer-left' }, [h('strong', { key: 'footer-strong' }, 'HyperFix'), ' — document exporté en PDF']),
        h('span', { key: 'footer-right' }, `© ${new Date().getFullYear()} HyperFix`),
      ]),
    ]),
  ]);
};

export const generatePdfFromMarkdown = async (options: PdfExportOptions): Promise<void> => {
  const { content, modelName = 'Gemini', title: customTitle } = options;

  if (typeof window === 'undefined') {
    throw new Error('PDF generation is only available in browser');
  }

  const title = customTitle || extractTitle(content);
  const date = formatPdfDate(new Date());

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
  iframe.style.cssText = 'width: 900px; height: 2400px; border: none; background: #ffffff;';
  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(wrapper);
    throw new Error('Impossible de créer le document iframe');
  }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${pdfStyles}</style></head><body><div id="pdf-root"></div></body></html>`);
  iframeDoc.close();

  const mountNode = iframeDoc.getElementById('pdf-root');
  if (!mountNode) {
    document.body.removeChild(wrapper);
    throw new Error('Impossible de créer le conteneur PDF');
  }

  const root = createRoot(mountNode);

  try {
    flushSync(() => {
      root.render(buildPdfDocument({ content, modelName, title, date }));
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const filename = `hyperfix-${generateSlug(title)}.pdf`;

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
          avoid: ['tr', 'pre', 'blockquote', '.pdf-header', '.pdf-title-block'],
        },
      })
      .from(mountNode)
      .save();
  } finally {
    root.unmount();
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

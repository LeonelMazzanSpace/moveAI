export interface EmailCta {
  label: string;
  url: string;
}

// Contact block at the bottom of every email; an empty string means the line is not shown.
export interface EmailFooter {
  address: string;
  hours: string;
  whatsapp: string;
  instagram: string;
  email: string;
}

export interface EmailLayoutInput {
  title: string;
  paragraphs: string[];
  cta?: EmailCta;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

const renderParagraph = (paragraph: string): string =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#ffffff;">${escapeHtml(paragraph)}</p>`;

const renderCta = ({ label, url }: EmailCta): string =>
  `<p style="margin:24px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-weight:bold;text-decoration:none;border-radius:4px;">${escapeHtml(label)}</a></p>`;

const footerLines = (footer?: EmailFooter): string[] => {
  if (!footer) return [];
  const { address, hours, whatsapp, instagram, email } = footer;
  return [
    address,
    hours,
    whatsapp && `WhatsApp ${whatsapp}`,
    instagram && `Instagram ${instagram}`,
    email,
  ].filter((line) => line !== '');
};

const renderFooterLine = (line: string): string =>
  `<p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#a3a3a3;">${escapeHtml(line)}</p>`;

const renderFooter = (footer?: EmailFooter): string => {
  const lines = footerLines(footer);
  if (lines.length === 0) return '';
  return `<div style="margin:32px 0 0;padding:16px 0 0;border-top:1px solid #333333;">${lines.map(renderFooterLine).join('')}</div>`;
};

export const wrapHtml = ({ title, paragraphs, cta }: EmailLayoutInput, footer?: EmailFooter): string =>
  [
    '<!DOCTYPE html>',
    '<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background-color:#000000;">',
    '<div style="max-width:560px;margin:0 auto;padding:32px 24px;background-color:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">',
    '<p style="margin:0 0 24px;font-size:20px;font-weight:bold;letter-spacing:4px;color:#ffffff;">MOVE</p>',
    `<h1 style="margin:0 0 24px;font-size:24px;line-height:1.2;color:#ffffff;">${escapeHtml(title)}</h1>`,
    ...paragraphs.map(renderParagraph),
    cta ? renderCta(cta) : '',
    renderFooter(footer),
    '</div>',
    '</body></html>',
  ].join('');

export const wrapText = ({ title, paragraphs, cta }: EmailLayoutInput, footer?: EmailFooter): string => {
  const lines = footerLines(footer);
  return [
    title,
    ...paragraphs,
    ...(cta ? [`${cta.label}: ${cta.url}`] : []),
    ...(lines.length > 0 ? [`--\n${lines.join('\n')}`] : []),
    'MOVE',
  ].join('\n\n');
};

// Formatting for the owner's batch review screen.
export function card(item, index, total, how) {
  const lines = [
    '',
    `── ${index + 1} of ${total} ── ${item.id}`,
    `${item.channel} / ${item.kind}${item.scheduled_for ? `   goes out ${item.scheduled_for}` : '   goes out when published'}   via ${how}`,
  ];
  if (item.target) lines.push(`to: ${item.target}`);
  if (item.content.title) lines.push(`title: ${item.content.title}`);
  lines.push('', item.content.text, '');
  if (item.content.link) lines.push(`link: ${item.content.link}`);
  if (item.content.media?.length) lines.push(`media: ${item.content.media.join(', ')}`);
  if (item.content.template) lines.push(`WhatsApp template: ${item.content.template.name}`);
  if (item.spend_inr) lines.push(`SPEND: ₹${item.spend_inr}`);
  if (item.lead) lines.push(`CRM: records ${item.lead.name || 'this lead'} after sending`);
  for (const w of item.lint_warnings || []) lines.push(`⚠ ${w}`);
  if (item.rationale) lines.push(`why: ${item.rationale}`);
  return lines.join('\n');
}

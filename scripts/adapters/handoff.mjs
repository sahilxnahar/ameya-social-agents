// Writes an approved item to outbox/<channel>/<id>.md so a person can post it by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../lib/queue.mjs';

export const adapter = {
  mode: 'handoff',
  missing: () => [],
  async send(item) {
    const dir = join(ROOT, 'outbox', item.channel);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${item.id}.md`);
    const lines = [
      `# ${item.channel} / ${item.kind}: ${item.id}`,
      '',
      `Approved by ${item.approval.by} at ${item.approval.at}`,
      item.target ? `Target: ${item.target}` : null,
      item.scheduled_for ? `Post at: ${item.scheduled_for}` : null,
      '',
      '## Text',
      '',
      item.content.text,
      item.content.link ? `\nLink: ${item.content.link}` : null,
      item.content.media?.length ? `\n## Media\n\n${item.content.media.map((m) => `- ${m}`).join('\n')}` : null,
      '',
      `When posted, run: npm run publish -- posted ${item.id} <url>`,
      '',
    ];
    writeFileSync(path, lines.filter((l) => l !== null).join('\n'));
    return { handoff: path.slice(ROOT.length + 1) };
  },
};

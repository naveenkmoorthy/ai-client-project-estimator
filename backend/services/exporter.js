const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN_X = 50;
const PDF_MARGIN_TOP = 60;
const PDF_FONT_SIZE = 11;
const PDF_LINE_HEIGHT = 14;
const PDF_MAX_CHARS_PER_LINE = 92;

function toDocumentText(estimateData) {
  const projectSummary = estimateData.normalizedInput || estimateData.input || estimateData;
  const projectDescription = projectSummary.projectDescription || 'N/A';
  const deadline = projectSummary.deadline || 'N/A';
  const budget = projectSummary.budget || {};
  const budgetText = `${budget.amount ?? 'N/A'} ${budget.currency || ''}`.trim();

  const taskBreakdown = (estimateData.taskBreakdown || [])
    .map((task) => `- ${task.task} (${task.estimatedHours}h): ${task.description}`)
    .join('\n');

  const timeline = (estimateData.timeline || [])
    .map((item) => `- ${item.date}: ${item.milestone}`)
    .join('\n');

  const costEstimate = estimateData.costEstimate || {};
  const risks = (estimateData.riskFlags || [])
    .map((risk) => `- [${String(risk.severity || '').toUpperCase()}] ${risk.issue} | Mitigation: ${risk.mitigation}`)
    .join('\n');

  const proposal = estimateData.proposalMarkdown || estimateData.proposalPlainText || estimateData.proposalDraft || 'N/A';

  return [
    'Project Estimate Export',
    '',
    'Project Overview',
    `Description: ${projectDescription}`,
    `Deadline: ${deadline}`,
    `Budget: ${budgetText}`,
    '',
    'Task Breakdown',
    taskBreakdown || '- N/A',
    '',
    'Timeline',
    timeline || '- N/A',
    '',
    'Cost Estimate',
    `Subtotal: ${costEstimate.subtotal ?? 'N/A'} ${costEstimate.currency || ''}`.trim(),
    `Contingency: ${costEstimate.contingency ?? 'N/A'} ${costEstimate.currency || ''}`.trim(),
    `Total: ${costEstimate.total ?? 'N/A'} ${costEstimate.currency || ''}`.trim(),
    '',
    'Risk Flags',
    risks || '- N/A',
    '',
    'Proposal',
    proposal
  ].join('\n');
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\x09\x0A\x20-\x7E]/g, '?');
}

function wrapText(rawText, maxChars) {
  const lines = [];
  const sourceLines = normalizeText(rawText).split('\n');

  for (const sourceLine of sourceLines) {
    if (!sourceLine.trim()) {
      lines.push('');
      continue;
    }

    let current = '';
    const words = sourceLine.trim().split(/\s+/);

    for (const word of words) {
      if (current.length === 0) {
        if (word.length <= maxChars) {
          current = word;
        } else {
          for (let index = 0; index < word.length; index += maxChars) {
            lines.push(word.slice(index, index + maxChars));
          }
        }
        continue;
      }

      if (current.length + 1 + word.length <= maxChars) {
        current += ` ${word}`;
        continue;
      }

      lines.push(current);
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let index = 0; index < word.length; index += maxChars) {
          lines.push(word.slice(index, index + maxChars));
        }
        current = '';
      }
    }

    if (current.length > 0) {
      lines.push(current);
    }
  }

  return lines;
}

function escapePdfText(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createPdfBuffer(estimateData) {
  const lines = wrapText(toDocumentText(estimateData), PDF_MAX_CHARS_PER_LINE);
  const startY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;
  const maxLines = Math.floor((PDF_PAGE_HEIGHT - PDF_MARGIN_TOP - PDF_MARGIN_X) / PDF_LINE_HEIGHT);
  const pageLines = lines.slice(0, Math.max(maxLines, 1));

  const textCommands = pageLines
    .map((line, index) => {
      const escapedLine = escapePdfText(line);
      if (index === 0) {
        return `${PDF_MARGIN_X} ${startY} Td (${escapedLine}) Tj`;
      }
      return `T* (${escapedLine}) Tj`;
    })
    .join('\n');

  const contentStream = `BT\n/F1 ${PDF_FONT_SIZE} Tf\n${PDF_LINE_HEIGHT} TL\n${textCommands}\nET`;

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  ];

  const header = '%PDF-1.4\n';
  let body = '';
  const offsets = [0];
  let offset = Buffer.byteLength(header, 'utf8');

  for (const object of objects) {
    offsets.push(offset);
    body += object;
    offset += Buffer.byteLength(object, 'utf8');
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, 'utf8');
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toWordParagraphs(text) {
  const lines = normalizeText(text).split('\n');
  return lines
    .map((line) => {
      if (!line.trim()) {
        return '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>';
      }
      return `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`;
    })
    .join('');
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xEDB88320 & mask);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function toDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getUTCFullYear());
  const dosTime = ((date.getUTCHours() & 0x1F) << 11) | ((date.getUTCMinutes() & 0x3F) << 5) | ((Math.floor(date.getUTCSeconds() / 2)) & 0x1F);
  const dosDate = (((year - 1980) & 0x7F) << 9) | (((date.getUTCMonth() + 1) & 0x0F) << 5) | (date.getUTCDate() & 0x1F);
  return { dosTime, dosDate };
}

function createZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = toDosDateTime();

  for (const file of files) {
    const fileNameBuffer = Buffer.from(file.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileNameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileNameBuffer);

    offset += localHeader.length + fileNameBuffer.length + dataBuffer.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, endRecord]);
}

function createDocxBuffer(estimateData) {
  const documentText = toDocumentText(estimateData);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${toWordParagraphs(documentText)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return createZipBuffer([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'word/document.xml', content: documentXml }
  ]);
}

module.exports = {
  createPdfBuffer,
  createDocxBuffer
};

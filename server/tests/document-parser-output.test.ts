import { describe, expect, it } from '@jest/globals';
import { parseParserOutput } from '#src/services/document-parser.service.ts';

const successJson = JSON.stringify({
  success: true,
  text: 'parsed text',
  metadata: { fileType: 'pdf', hasOCR: false },
});

describe('parser subprocess output contract', () => {
  it('accepts valid JSON stdout', () => {
    expect(
      parseParserOutput({ stdout: successJson, stderr: '', exitCode: 0 })
    ).toMatchObject({ success: true, text: 'parsed text' });
  });

  it('ignores diagnostics on stderr when stdout is valid JSON', () => {
    expect(
      parseParserOutput({
        stdout: successJson,
        stderr: 'fitz deprecation warning',
        exitCode: 0,
      })
    ).toMatchObject({ success: true });
  });

  it('rejects non-JSON stdout without extracting a payload', () => {
    expect(
      parseParserOutput({ stdout: 'warning before json', stderr: '', exitCode: 0 })
    ).toMatchObject({
      success: false,
      error: { code: 'OUTPUT_PARSE_ERROR' },
    });
  });

  it('rejects empty stdout', () => {
    expect(
      parseParserOutput({ stdout: '', stderr: '', exitCode: 0 })
    ).toMatchObject({
      success: false,
      error: { code: 'EMPTY_OUTPUT' },
    });
  });

  it('rejects a successful-looking payload from a failed process', () => {
    expect(
      parseParserOutput({ stdout: successJson, stderr: 'failed', exitCode: 1 })
    ).toMatchObject({
      success: false,
      error: { code: 'PARSE_FAILED' },
    });
  });
});

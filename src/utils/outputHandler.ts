const MAX_OUTPUT_SIZE = 100 * 1024; // 100KB limit for output

export function truncateOutput(text: string, limit = MAX_OUTPUT_SIZE): string {
  if (text.length > limit) {
    const truncatedMsg = `\n\n[OUTPUT TRUNCATED - exceeded ${limit} bytes limit]\n`;
    return text.slice(0, limit - truncatedMsg.length) + truncatedMsg;
  }
  return text;
}

export { MAX_OUTPUT_SIZE };

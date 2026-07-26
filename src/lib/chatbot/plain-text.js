export function formatAssistantPlainText(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```[^\n]*\n?|\n?```$/g, '')
    )
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*\*\s+/gm, '- ')
    .trim()
}

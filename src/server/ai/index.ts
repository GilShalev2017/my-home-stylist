import type { AIProviders } from './types';
import { ClaudeProductLocator, ClaudeRoomAnalyzer, ClaudeStylist } from './anthropic';
import { OpenAIImageEditor } from './openai-image';
import { DemoImageEditor, DemoProductLocator, DemoRoomAnalyzer, DemoStylist } from './mock';

/**
 * Chooses providers from environment configuration. Each capability can fall back to the demo
 * provider independently, so e.g. product selection can run live while images are still demo.
 */
export function getAI(): AIProviders {
  const forceDemo = process.env.AI_MOCK === '1' || process.env.AI_MOCK === 'true';
  const hasClaude = !forceDemo && !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !forceDemo && !!process.env.OPENAI_API_KEY;
  const missing: string[] = [];
  if (!hasClaude) missing.push('ANTHROPIC_API_KEY');
  if (!hasOpenAI) missing.push('OPENAI_API_KEY');

  const editor = hasOpenAI ? new OpenAIImageEditor() : new DemoImageEditor();
  return {
    mode: hasClaude && hasOpenAI ? 'live' : 'demo',
    analyzer: hasClaude ? new ClaudeRoomAnalyzer() : new DemoRoomAnalyzer(),
    stylist: hasClaude ? new ClaudeStylist() : new DemoStylist(),
    locator: hasClaude ? new ClaudeProductLocator() : new DemoProductLocator(),
    editor,
    status: {
      analyzer: hasClaude ? `Claude (${process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'})` : 'demo',
      stylist: hasClaude ? `Claude (${process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'})` : 'demo',
      editor: hasOpenAI ? `OpenAI (${editor.model})` : 'demo',
      missing: forceDemo ? ['AI_MOCK is set'] : missing,
    },
  };
}

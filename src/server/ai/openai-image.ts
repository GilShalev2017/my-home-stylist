import OpenAI, { toFile } from 'openai';
import type { EditRequest, ImageEditor, ImageInput } from './types';

/** Detect the real image format from its first bytes (don't trust what we asked for). */
function sniff(base64: string): ImageInput['mediaType'] {
  const head = Buffer.from(base64.slice(0, 24), 'base64');
  if (head[0] === 0x89 && head[1] === 0x50) return 'image/png';
  if (head[0] === 0x52 && head[1] === 0x49 && head[8] === 0x57) return 'image/webp';
  return 'image/jpeg';
}

/** Photo-realistic editing of the user's own photo with OpenAI GPT Image models. */
export class OpenAIImageEditor implements ImageEditor {
  readonly model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';

  async editRoom(req: EditRequest) {
    // Stay under Vercel's 300 s function limit so we can return a clear timeout error.
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 250_000, maxRetries: 0 });
    const ext = (m: string) => (m === 'image/png' ? 'png' : m === 'image/webp' ? 'webp' : 'jpg');
    const files = await Promise.all([
      toFile(Buffer.from(req.room.base64, 'base64'), `room.${ext(req.room.mediaType)}`, { type: req.room.mediaType }),
      ...req.references.map((r, i) => toFile(Buffer.from(r.image.base64, 'base64'), `product-${i + 1}.${ext(r.image.mediaType)}`, { type: r.image.mediaType })),
    ]);
    const supportsFidelity = !/^gpt-image-2/.test(this.model);
    const quality = req.quality ?? ((process.env.OPENAI_IMAGE_QUALITY as 'low' | 'medium' | 'high') || 'high');
    const res = await client.images.edit({
      model: this.model,
      image: files,
      prompt: req.prompt,
      size: req.size,
      quality,
      output_format: 'jpeg',
      output_compression: 85,
      ...(supportsFidelity ? { input_fidelity: 'high' as const } : {}),
      n: 1,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('The image model returned no image');
    return { base64: b64, mediaType: sniff(b64), quality, usage: (res as { usage?: unknown }).usage };
  }
}

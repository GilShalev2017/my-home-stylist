import OpenAI, { toFile } from 'openai';
import type { EditRequest, ImageEditor, ImageInput } from './types';

/** Photo-realistic editing of the user's own photo with OpenAI GPT Image models. */
export class OpenAIImageEditor implements ImageEditor {
  readonly model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';

  async editRoom(req: EditRequest): Promise<{ base64: string; mediaType: ImageInput['mediaType'] }> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 280_000, maxRetries: 0 });
    const ext = (m: string) => (m === 'image/png' ? 'png' : m === 'image/webp' ? 'webp' : 'jpg');
    const files = await Promise.all([
      toFile(Buffer.from(req.room.base64, 'base64'), `room.${ext(req.room.mediaType)}`, { type: req.room.mediaType }),
      ...req.references.map((r, i) => toFile(Buffer.from(r.image.base64, 'base64'), `product-${i + 1}.${ext(r.image.mediaType)}`, { type: r.image.mediaType })),
    ]);
    const supportsFidelity = !/^gpt-image-2/.test(this.model);
    const res = await client.images.edit({
      model: this.model,
      image: files,
      prompt: req.prompt,
      size: req.size,
      quality: (process.env.OPENAI_IMAGE_QUALITY as 'low' | 'medium' | 'high') || 'high',
      output_format: 'jpeg',
      output_compression: 90,
      ...(supportsFidelity ? { input_fidelity: 'high' as const } : {}),
      n: 1,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('Image model returned no image');
    return { base64: b64, mediaType: 'image/jpeg' };
  }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const FACES = ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"] as const;
export type FaceKey = (typeof FACES)[number];

export const FIELD_KEYS = [
  "genericName",
  "netQuantity",
  "mrp",
  "taxClause",
  "manufacturer",
  "packer",
  "importer",
  "manufactureDate",
  "consumerCare",
  "countryOfOrigin",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export type Box = { x: number; y: number; w: number; h: number };

export type Region = {
  text: string;
  language: string;
  confidence: number;
  box: Box | null;
};

export type FieldRead = {
  value: string;
  confidence: number;
  language: string;
  box: Box | null;
};

export type FaceReading = {
  face: FaceKey;
  quality: { score: number; blurred: boolean; glare: boolean; note: string };
  regions: Region[];
  fields: Partial<Record<FieldKey, FieldRead>>;
  rawText: string;
};

const Input = z.object({
  face: z.enum(FACES),
  imageDataUrl: z.string().min(32),
});

const SYSTEM = `You are the vision layer of a Legal Metrology (Packaged Commodities) Rules, 2011 inspection tool used by Indian enforcement officers.
You are given one photograph of one face of a pre-packaged commodity.
Read only what is legibly printed. Never invent or complete a value you cannot actually read; use null instead.
Indian labels are often multilingual (English, Hindi, Bengali, Gujarati, Marathi, Tamil, Telugu, Kannada, Malayalam, Punjabi). Report the script/language you read each region in.
Bounding boxes are normalised fractions of the image: x and y are the top-left corner, w and h the size, all between 0 and 1.
Confidence is 0-100 and must reflect real legibility: low for blurred, angled, glared or partially hidden text.

Respond with JSON only:
{
 "quality": {"score": number, "blurred": boolean, "glare": boolean, "note": string},
 "regions": [{"text": string, "language": string, "confidence": number, "box": {"x":number,"y":number,"w":number,"h":number}}],
 "fields": {
   "genericName": null | {"value": string, "confidence": number, "language": string, "box": {"x":number,"y":number,"w":number,"h":number}},
   "netQuantity": null | {...},
   "mrp": null | {...},
   "taxClause": null | {...},
   "manufacturer": null | {...},
   "packer": null | {...},
   "importer": null | {...},
   "manufactureDate": null | {...},
   "consumerCare": null | {...},
   "countryOfOrigin": null | {...}
 },
 "rawText": string
}
"taxClause" is filled only when wording equivalent to "inclusive of all taxes" is actually printed. "manufactureDate" keeps the printed format, for example 07/2026.`;

const BoxSchema = z
  .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
  .nullable()
  .optional();

const FieldSchema = z
  .object({
    value: z.string(),
    confidence: z.number().optional(),
    language: z.string().optional(),
    box: BoxSchema,
  })
  .nullable()
  .optional();

const Response = z.object({
  quality: z
    .object({
      score: z.number().optional(),
      blurred: z.boolean().optional(),
      glare: z.boolean().optional(),
      note: z.string().optional(),
    })
    .optional(),
  regions: z
    .array(
      z.object({
        text: z.string(),
        language: z.string().optional(),
        confidence: z.number().optional(),
        box: BoxSchema,
      }),
    )
    .optional(),
  fields: z.record(z.string(), FieldSchema).optional(),
  rawText: z.string().optional(),
});

const clampBox = (box: unknown): Box | null => {
  const parsed = BoxSchema.safeParse(box);
  if (!parsed.success || !parsed.data) return null;
  const { x, y, w, h } = parsed.data;
  if ([x, y, w, h].some((n) => Number.isNaN(n))) return null;
  const nx = Math.min(Math.max(x, 0), 1);
  const ny = Math.min(Math.max(y, 0), 1);
  return { x: nx, y: ny, w: Math.min(Math.max(w, 0.005), 1 - nx), h: Math.min(Math.max(h, 0.005), 1 - ny) };
};

const clampConfidence = (value: number | undefined) =>
  value === undefined || Number.isNaN(value) ? 0 : Math.min(Math.max(Math.round(value), 0), 100);

/** Reads one package face. The client calls this once per captured face so the
 *  inspector sees per-face progress and every reading keeps its own evidence. */
export const readFace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<FaceReading> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Label reading is not configured for this project.");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `This is the ${data.face} face of the package. Detect every printed text region and the mandatory declarations visible on it.` },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("Label reading is rate limited. Wait a moment and try again.");
      if (response.status === 402) throw new Error("AI credits are exhausted. Add credits to continue reading labels.");
      if (response.status === 403) throw new Error("AI use is blocked by a workspace setting or credit limit.");
      throw new Error(`Reading the ${data.face} face failed (${response.status}): ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content ?? "{}";
    let parsed: z.infer<typeof Response>;
    try {
      parsed = Response.parse(JSON.parse(content));
    } catch {
      throw new Error(`The ${data.face} face could not be read. Try a sharper, straight-on photograph.`);
    }

    const fields: Partial<Record<FieldKey, FieldRead>> = {};
    for (const fieldKey of FIELD_KEYS) {
      const raw = parsed.fields?.[fieldKey];
      if (!raw || !raw.value || raw.value.trim().length < 1) continue;
      fields[fieldKey] = {
        value: raw.value.trim(),
        confidence: clampConfidence(raw.confidence ?? 0),
        language: raw.language?.trim() || "English",
        box: clampBox(raw.box),
      };
    }

    return {
      face: data.face,
      quality: {
        score: clampConfidence(parsed.quality?.score ?? 0),
        blurred: Boolean(parsed.quality?.blurred),
        glare: Boolean(parsed.quality?.glare),
        note: parsed.quality?.note?.trim() || "",
      },
      regions: (parsed.regions ?? [])
        .filter((region) => region.text.trim().length > 0)
        .map((region) => ({
          text: region.text.trim(),
          language: region.language?.trim() || "English",
          confidence: clampConfidence(region.confidence),
          box: clampBox(region.box),
        })),
      fields,
      rawText: parsed.rawText?.trim() ?? "",
    };
  });

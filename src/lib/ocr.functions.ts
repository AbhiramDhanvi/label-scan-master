import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  imageDataUrl: z.string().min(32),
});

export type LabelReading = {
  productCode: string | null;
  productName: string | null;
  netQuantity: string | null;
  mrp: string | null;
  taxClausePresent: boolean;
  manufacturer: string | null;
  manufactureDate: string | null;
  consumerCare: string | null;
  countryOfOrigin: string | null;
  genericName: string | null;
  rawText: string;
  notes: string | null;
};

const SYSTEM = `You read photographs of Indian pre-packaged commodity labels for a Legal Metrology inspector.
Extract only what is legibly printed on the label. Never guess or invent values; use null when a field is not clearly readable.
Respond with JSON only, using this shape:
{"productCode":string|null,"productName":string|null,"netQuantity":string|null,"mrp":string|null,"taxClausePresent":boolean,"manufacturer":string|null,"manufactureDate":string|null,"consumerCare":string|null,"countryOfOrigin":string|null,"genericName":string|null,"rawText":string,"notes":string|null}
taxClausePresent is true only when the label prints wording equivalent to "inclusive of all taxes".
manufactureDate should keep the printed format (for example 07/2026). rawText is all text you can read.`;

export const readLabel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<LabelReading> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

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
              { type: "text", text: "Read every mandatory declaration printed on this packaged commodity label." },
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
      throw new Error(`Label reading failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<LabelReading>;
    try {
      parsed = JSON.parse(content) as Partial<LabelReading>;
    } catch {
      throw new Error("The label text could not be read clearly. Try a sharper, straight-on photo.");
    }

    return {
      productCode: parsed.productCode ?? null,
      productName: parsed.productName ?? null,
      netQuantity: parsed.netQuantity ?? null,
      mrp: parsed.mrp ?? null,
      taxClausePresent: Boolean(parsed.taxClausePresent),
      manufacturer: parsed.manufacturer ?? null,
      manufactureDate: parsed.manufactureDate ?? null,
      consumerCare: parsed.consumerCare ?? null,
      countryOfOrigin: parsed.countryOfOrigin ?? null,
      genericName: parsed.genericName ?? null,
      rawText: parsed.rawText ?? "",
      notes: parsed.notes ?? null,
    };
  });

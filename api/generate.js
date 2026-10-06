import Busboy from "busboy";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY non configurata su Vercel.",
    });
  }

  try {
    const { fields, file } = await parseMultipart(req);

    if (!file) {
      return res.status(400).json({
        error: "Nessuna foto ricevuta.",
      });
    }

    const style = fields.style || "Dark European Estate";
    const budget = fields.budget || "5000";
    const dimensions = fields.dimensions || "4 m × 6.5 m";
    const preserve = fields.preserve || "";
    const modify = fields.modify || "";

    const prompt = `
Transform the uploaded room photograph into a realistic high-end interior design visualization.

ROOM:
- Living room
- Dimensions: ${dimensions}
- Design style: ${style}
- Budget target: €${budget}

ABSOLUTELY PRESERVE:
${preserve}

DO NOT change, remove, move or redesign the architecture or structural elements.
Preserve the exact room geometry, perspective, walls, ceiling, floor, windows, doors and staircase.
Preserve the existing television and its position.

CHANGE ONLY:
${modify}

DESIGN DIRECTION:
Create a sophisticated, realistic and coherent interior.
Use high-quality furniture, lighting, textiles, artwork and decorative objects appropriate to the selected style.
The result must look like a professionally photographed real interior, not a 3D cartoon.

For Dark European Estate specifically, favor:
- rich burgundy
- dark walnut
- black marble
- antique brass
- cream accents
- velvet
- classic European furniture
- Persian-inspired rug
- elegant statement chandelier
- framed artwork
- heavy curtains
- tasteful greenery
- warm cinematic lighting

IMPORTANT:
Do not add text, labels, prices, product names, logos or watermarks to the image.
Keep the original camera viewpoint and room proportions as faithful as possible.
`;

    const form = new FormData();

    form.append(
      "model",
      "gpt-image-2.5-sunburst"
    );

    form.append("prompt", prompt);

    form.append(
      "image",
      new Blob([file.buffer], {
        type: file.mimeType || "image/jpeg",
      }),
      file.filename || "room.jpg"
    );

    form.append("size", "1024x1024");
    form.append("quality", "medium");
    form.append("output_format", "jpeg");
    form.append("output_compression", "60");

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: form,
      }
    );

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error:
          data?.error?.message ||
          "Errore durante la generazione OpenAI.",
      });
    }

    const image = data?.data?.[0]?.b64_json;

    if (!image) {
      return res.status(500).json({
        error: "OpenAI non ha restituito un'immagine.",
      });
    }

    return res.status(200).json({
      image: `data:image/jpeg;base64,${image}`,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error?.message ||
        "Errore interno durante la generazione.",
    });
  }
}


function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024,
      },
    });

    const fields = {};
    let fileData = null;

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("file", (name, stream, info) => {
      const chunks = [];

      stream.on("data", (chunk) => {
        chunks.push(chunk);
      });

      stream.on("end", () => {
        fileData = {
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          mimeType: info.mimeType,
        };
      });
    });

    bb.on("finish", () => {
      resolve({
        fields,
        file: fileData,
      });
    });

    bb.on("error", reject);

    req.pipe(bb);
  });
}

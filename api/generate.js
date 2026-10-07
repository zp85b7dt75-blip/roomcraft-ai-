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
Transform the uploaded room photograph into a photorealistic,
high-end interior design visualization.

THIS IS A CONTROLLED ROOM TRANSFORMATION.

The uploaded photograph is the PRIMARY SOURCE OF TRUTH.
The final image must remain recognizably the SAME physical room,
seen from the SAME camera position.

==================================================
ROOM INFORMATION
==================================================

- Room type: Living room
- Dimensions: ${dimensions}
- Design style: ${style}
- Budget target: €${budget}

==================================================
HIGHEST PRIORITY: PRESERVE THE EXISTING ROOM
==================================================

Preserve the existing physical architecture exactly.

DO NOT:
- change the room layout
- change wall positions
- change ceiling height
- change the floor plan
- move doors
- move windows
- add windows
- remove windows
- add doors
- remove doors
- change the staircase
- change the staircase position
- change structural beams
- change architectural openings
- change the perspective
- change the camera viewpoint
- change the camera height
- change the focal composition
- change the proportions of the room

The final image must look as if the SAME room was professionally
renovated and photographed from the SAME position.

Do not create a different room inspired by the photograph.

==================================================
ELEMENTS TO PRESERVE
==================================================

The user explicitly requires these elements to remain unchanged:

${preserve}

Treat these elements as FIXED CONSTRAINTS.

Do not move, replace, resize, redesign or reinterpret them.

==================================================
ELEMENTS THAT MAY BE CHANGED
==================================================

Only modify the elements explicitly requested by the user:

${modify}

Everything not listed as changeable should remain as close as
possible to the original photograph.

==================================================
DESIGN OBJECTIVE
==================================================

Apply the requested interior design style while respecting all
physical constraints of the original room.

The design should feel intentional, sophisticated and realistic.

Furniture, lighting, textiles, artwork and decorative objects
should be appropriately selected for the requested style.

Do not let the design style override the physical characteristics
of the original room.

==================================================
DARK EUROPEAN ESTATE STYLE
==================================================

When the selected style is "Dark European Estate", favor:

- rich burgundy accents
- dark walnut
- black or dark stone
- antique brass
- cream and warm neutral accents
- velvet
- elegant European furniture
- Persian-inspired rugs
- sophisticated chandeliers
- framed artwork
- substantial curtains
- tasteful greenery
- warm cinematic lighting

Use these characteristics selectively and coherently.

Do not exaggerate the style to the point that the room loses
its original identity.

==================================================
PHOTOREALISM
==================================================

The result must look like a real professionally photographed
interior.

Use:
- realistic materials
- realistic lighting
- realistic shadows
- realistic reflections
- realistic furniture proportions
- realistic object placement
- natural depth and perspective

Avoid:
- CGI appearance
- cartoon appearance
- artificial-looking furniture
- impossible geometry
- distorted architecture
- floating objects

==================================================
FINAL VERIFICATION
==================================================

Before producing the final image, prioritize these requirements
in this order:

1. Preserve the original room geometry.
2. Preserve the original camera viewpoint and perspective.
3. Preserve all user-specified fixed elements.
4. Modify only the requested elements.
5. Apply the requested design style.
6. Maintain photorealism.

If there is a conflict between design ambition and preservation
of the original room, ALWAYS prioritize preservation.

==================================================
IMAGE CONTENT RESTRICTIONS
==================================================

Do not add:
- text
- labels
- prices
- product names
- logos
- watermarks
- UI elements
- written descriptions

Return only the finished interior design visualization.
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

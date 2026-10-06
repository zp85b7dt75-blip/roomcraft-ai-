export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks);

    const contentType = req.headers["content-type"];

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": contentType,
      },
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "OpenAI API error",
      });
    }

    if (!data.data?.[0]?.b64_json) {
      return res.status(500).json({
        error: "OpenAI non ha restituito l'immagine.",
      });
    }

    return res.status(200).json({
      image: `data:image/png;base64,${data.data[0].b64_json}`,
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Errore interno del server.",
    });
  }
}

// index.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// ==========================================
// CONFIGURAÇÕES - COLOQUE SUAS CHAVES AQUI
// ==========================================
const VERIFY_TOKEN = "IGAALBZBhPKcCJBZAE0zSlAtc01ZAeFA3dk9sWEtBRE5hckdrQjNlTUhGQktDTjFNT0NfSXFuNFBTTDZAqaUlIYnlGcmFKOU5KbHdaWldzemh1dVZAYZA0JlU0prZAWE0RnBIcEdGcmtveGNDN05na21ldHFEM2lQWDJqdGZAJNUtWY3NOQQZDZD"; // mesmo do Meta Developers
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const INSTAGRAM_ACCESS_TOKEN = "EAFgKiZASpbsYBPXymo7LB1rHylWzbhhwg2XyCY7lfkHrjrlq6UR9vWq1LF7fTiLLM0bC7DE2xMMA5NAZCP1FpbBYeHSa0svUjxI1TiIZCh3rklcPdY9Dn3PAM3ZAFlJsrUQNJv850wT1S22ZCfiZAPew0eLzt8F8TamiPhdd2tAGRZAuZBbD3nHZCMsxSy18ejTWG1ZADQsiResNYyi1qTPqRraknbmRSdU1FeKpvCP37p3CXuuFrI7aIY"; // <- long-lived token do Instagram Graph API
// ==========================================

// Rota para verificar o webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token && mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado ✅");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Rota para receber eventos do Instagram
app.post("/webhook", async (req, res) => {
  console.log("Evento recebido:", JSON.stringify(req.body, null, 2));

  const entries = req.body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field === "comments") {
        const commentId = change.value.id;
        const commentText = change.value.text;

        try {
          // Chama a OpenAI para gerar resposta
          const openaiResp = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-4.1-mini",
              messages: [
                {
                  role: "system",
                  content: "Você é um assistente simpático que responde comentários de Instagram."
                },
                { role: "user", content: commentText }
              ],
            },
            {
              headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
              }
            }
          );

          const replyText = openaiResp.data.choices[0].message.content;

          // Posta resposta no Instagram
          await axios.post(
            `https://graph.facebook.com/${commentId}/replies`,
            { message: replyText, access_token: INSTAGRAM_ACCESS_TOKEN }
          );

          console.log("Comentário respondido:", replyText);
        } catch (error) {
          console.error("Erro ao responder comentário:", error.response?.data || error.message);
        }
      }
    }
  }

  res.sendStatus(200);
});

// Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

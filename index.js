const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// ⚡ Token de verificação que você definiu no Meta Developers
const VERIFY_TOKEN = "meu_token_secreto";

// Rota para verificar o webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK VERIFICADO ✅");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Rota para receber eventos do Instagram
app.post("/webhook", (req, res) => {
  console.log("Evento recebido:", JSON.stringify(req.body, null, 2));

  // Aqui no futuro você pode programar resposta automática

  res.sendStatus(200);
});

// Porta para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

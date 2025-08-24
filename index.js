// index.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// ==========================================
// CONFIGURAÇÕES - COLOQUE SUAS CHAVES AQUI
// ==========================================
const VERIFY_TOKEN = "IGAALBZBhPKcCJBZAE0zSlAtc01ZAeFA3dk9sWEtBRE5hckdrQjNlTUhGQktDTjFNT0NfSXFuNFBTTDZAqaUlIYnlGcmFKOU5KbHdaWldzemh1dVZAYZA0JlU0prZAWE0RnBIcEdGcmtveGNDN05na21ldHFEM2lQWDJqdGZAJNUtWY3NOQQZDZD";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const INSTAGRAM_ACCESS_TOKEN = "EAFgKiZASpbsYBPfgTYWt8t2DjWcKQlK4b6erAqFJzkdLH1l4ypgaAoGPynBnmKZCfCqeoct0HDOVTFqCvGGVDS3hdexZCsTQf868BB46DGQZCPbEDhNZBTAYgR9MOzYG49EaTNU90H5wZA5v612T5MZA26ZCPH4dGQSpvJSvmRF2QkavfDQmvJbi7nS1CrN1cTnzpitzjLvkvj9z";
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
    console.log("Falha na verificação. Token recebido:", token);
    res.sendStatus(403);
  }
});

// Função para processar mensagens diretas (DM)
async function processDirectMessage(messagingEvent) {
  try {
    const senderId = messagingEvent.sender.id;
    const messageText = messagingEvent.message.text;

    console.log("Mensagem direta recebida de:", senderId);
    console.log("Texto da mensagem:", messageText);

    // Chama a OpenAI para gerar resposta
    const openaiResp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          { 
            role: "system", 
            content: "Você é um assistente simpático que responde mensagens do Instagram de forma amigável e útil." 
          },
          { role: "user", content: messageText }
        ],
        max_tokens: 150
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const replyText = openaiResp.data.choices[0].message.content;

    // Envia resposta via Direct Message
    await axios.post(
      `https://graph.facebook.com/v22.0/me/messages`,
      {
        recipient: { id: senderId },
        message: { text: replyText }
      },
      {
        params: {
          access_token: INSTAGRAM_ACCESS_TOKEN
        }
      }
    );

    console.log("Resposta enviada via DM:", replyText);
  } catch (error) {
    console.error("Erro ao processar mensagem direta:", error.response?.data || error.message);
  }
}

// Rota para receber eventos do Instagram
app.post("/webhook", async (req, res) => {
  console.log("Evento recebido:", JSON.stringify(req.body, null, 2));

  // Responde imediatamente para evitar timeout
  res.sendStatus(200);

  try {
    const entries = req.body.entry || [];
    
    for (const entry of entries) {
      // Processa mensagens diretas (DM)
      if (entry.messaging) {
        for (const messagingEvent of entry.messaging) {
          if (messagingEvent.message && messagingEvent.message.text) {
            await processDirectMessage(messagingEvent);
          }
        }
      }
      
      // Processa comentários
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field === "comments") {
          console.log("Dados completos do comentário:", JSON.stringify(change.value, null, 2));
          
          // Tenta obter o comment_id de diferentes formas
          const commentData = change.value;
          let commentId = commentData.comment_id || commentData.id;
          const commentText = commentData.text;
          const mediaId = commentData.media_id;

          console.log("ID do comentário recebido:", commentId);
          console.log("Texto do comentário:", commentText);
          console.log("ID da mídia:", mediaId);

          if (!commentId) {
            console.error("Nenhum ID de comentário encontrado nos dados");
            return;
          }

          // Chama a OpenAI para gerar resposta
          const openaiResp = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-4",
              messages: [
                { 
                  role: "system", 
                  content: "Você é um assistente simpático que responde comentários de Instagram de forma amigável e útil." 
                },
                { role: "user", content: commentText }
              ],
              max_tokens: 150
            },
            {
              headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
              }
            }
          );

          const replyText = openaiResp.data.choices[0].message.content;

          // Tenta responder ao comentário
          try {
            await axios.post(
              `https://graph.facebook.com/v22.0/${commentId}/replies`,
              {
                message: replyText
              },
              {
                params: {
                  access_token: INSTAGRAM_ACCESS_TOKEN
                }
              }
            );
            console.log("Comentário respondido:", replyText);
          } catch (error) {
            console.error("Erro ao responder comentário:", error.response?.data || error.message);
            
            // Se falhar, tenta usar o mediaId para encontrar o comentário real
            if (mediaId && error.response?.data?.error?.code === 100) {
              console.log("Tentando buscar comentários diretamente da mídia...");
              
              try {
                // Busca os comentários da publicação
                const mediaResponse = await axios.get(
                  `https://graph.facebook.com/v22.0/${mediaId}/comments`,
                  {
                    params: {
                      access_token: INSTAGRAM_ACCESS_TOKEN,
                      fields: "id,text,username"
                    }
                  }
                );
                
                console.log("Comentários da publicação:", JSON.stringify(mediaResponse.data, null, 2));
              } catch (mediaError) {
                console.error("Erro ao buscar comentários da mídia:", mediaError.response?.data || mediaError.message);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Erro geral no webhook:", error.message);
  }
});

// Rota de saúde para verificar se o servidor está online
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Servidor está funcionando" });
});

// Inicializa servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

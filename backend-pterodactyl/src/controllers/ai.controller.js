const fs = require('fs');
const {
  transcribeAudio,
  synthesizeSpeech,
  runAssistantTurn,
} = require('../services/openai.service');

/**
 * POST /api/ai/voice-command
 * multipart/form-data: audio=<file>, lat=<number>, lng=<number>, history=<json string, optional>
 *
 * Full pipeline: Whisper transcribe -> GPT function-calling -> TTS.
 * Response: { transcript, reply_text, actions[], audio_base64 }
 */
async function voiceCommand(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file is required (field name: audio)' });
    }

    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    let history = [];
    if (req.body.history) {
      try {
        history = JSON.parse(req.body.history);
      } catch {
        // ignore malformed history, start fresh
      }
    }

    const mode = req.body.mode === 'walking' ? 'walking' : 'driving';
    const transcript = await transcribeAudio(req.file.path, req.file.originalname);

    const { replyText, actions } = await runAssistantTurn({
      userText: transcript,
      userLocation: { lat, lng },
      history,
      mode,
      userId: req.user.id,
    });

    const audioBuffer = await synthesizeSpeech(replyText);

    return res.json({
      transcript,
      reply_text: replyText,
      actions,
      audio_base64: audioBuffer.toString('base64'),
    });
  } catch (err) {
    next(err);
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
}

/**
 * POST /api/ai/chat
 * JSON body: { message, lat, lng, history? }
 * Text-only variant of the same pipeline (useful for debugging without mic).
 */
async function chat(req, res, next) {
  try {
    const { message, lat, lng, history = [], mode, speak = true } = req.body;
    if (!message || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'message, lat and lng are required' });
    }

    const { replyText, actions } = await runAssistantTurn({
      userText: message,
      userLocation: { lat, lng },
      history,
      mode: mode === 'walking' ? 'walking' : 'driving',
      userId: req.user.id,
    });

    const audioBuffer = speak ? await synthesizeSpeech(replyText) : null;

    return res.json({
      reply_text: replyText,
      actions,
      audio_base64: audioBuffer ? audioBuffer.toString('base64') : null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { voiceCommand, chat };

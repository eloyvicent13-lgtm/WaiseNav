require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 8164),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    ttsModel: process.env.OPENAI_TTS_MODEL || 'tts-1',
    ttsVoice: process.env.OPENAI_TTS_VOICE || 'alloy',
    whisperModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  },

  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
};

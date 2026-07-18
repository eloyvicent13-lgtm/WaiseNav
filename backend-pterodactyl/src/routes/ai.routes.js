const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const { requireAuth } = require('../middleware/auth');
const { voiceCommand, chat } = require('../controllers/ai.controller');

const upload = multer({ dest: path.join(os.tmpdir(), 'waisenav-audio') });

const router = Router();

router.post('/voice-command', requireAuth, upload.single('audio'), voiceCommand);
router.post('/chat', requireAuth, chat);

module.exports = router;

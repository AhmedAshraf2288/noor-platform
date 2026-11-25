const express = require('express');
const db = require('../db');

const router = express.Router();

// Public site settings: payment info + sales WhatsApp (editable by admin)
router.get('/site', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    whatsapp: s.whatsapp || '',
    instapay: s.instapay || '',
    wallet: s.wallet || '',
    walletName: s.wallet_name || '',
    paymentNoteAr: s.payment_note_ar || '',
    paymentNoteEn: s.payment_note_en || '',
  });
});

module.exports = router;

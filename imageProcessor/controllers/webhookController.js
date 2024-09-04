// controllers/webhookController.js
const express = require('express');
const router = express.Router();

router.post('/webhook', (req, res) => {
    // Handle the webhook notification here
    console.log('Webhook received:', req.body);

    // Respond to acknowledge receipt of the webhook
    res.status(200).send('Webhook received');
});

module.exports = router;

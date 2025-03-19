const axios = require('axios');
require("dotenv").config();

// Blink API details (replace with your own)
const BLINK_API_URL = 'https://api.blink.sv/graphql';
const API_KEY = process.env.BLINK_API_KEY; // Get this from Blink

// Function to send sats to a recipient
async function sendSats(recipientAddress, amountSats) {
  try {
    const query = `
      mutation SendPayment($invoice: String!, $amount: Int!) {
        sendPayment(invoice: $invoice, amount: $amount) {
          paymentHash
          status
        }
      }
    `;
    const variables = {
      invoice: recipientAddress, // BOLT11 invoice or Lightning address
      amount: amountSats,
    };

    const response = await axios.post(
      BLINK_API_URL,
      { query, variables },
      { headers: { Authorization: `Bearer ${API_KEY}` } }
    );

    if (response.data.data.sendPayment.status === 'SUCCESS') {
      console.log(`Sent ${amountSats} sats! Payment hash: ${response.data.data.sendPayment.paymentHash}`);
      return { success: true, paymentHash: response.data.data.sendPayment.paymentHash };
    } else {
      throw new Error('Payment failed');
    }
  } catch (error) {
    console.error('Error sending sats:', error.message);
    return { success: false, error: error.message };
  }
}

// Example: Trigger payment on an event (e.g., sale)
function onSaleEvent(recipient, amount) {
  sendSats(recipient, amount).then(result => {
    console.log(result);
  });
}

// Simulate an event
onSaleEvent('user@domain.com', 1000); // Replace with real recipient and amount
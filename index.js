const express = require("express");
const axios = require("axios");
const IntaSend = require('intasend-node');

const app = express();
require("dotenv").config();
const cors = require("cors");
  

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("<h1>Hello World!</h1>");
});

app.post("/intasend", async (req, res) => {
  const amount = req.body.amount;
  const PhoneNumber = req.body.phoneNumber
  console.log(amount, PhoneNumber)
  try {
    const intasend = new IntaSend(
      process.env.ISPubKey,
      process.env.ISSecretKey,
      true // True for a test environment
    );

    const collection = intasend.collection();
    
    // Initiate MPESA STK Push
    const stkResponse = await collection.mpesaStkPush({
      first_name: "Joe",
      last_name: "Doe",
      email: "joe@doe.com",
      host: "https://yourwebsite.com",
      amount: amount,
      phone_number: PhoneNumber,
    });

    if (!stkResponse || !stkResponse.invoice || !stkResponse.invoice.invoice_id) {
      throw new Error("Failed to initiate transaction.");
    }

    const invoiceID = stkResponse.invoice.invoice_id;
    console.log(`Transaction initiated, Invoice ID: ${invoiceID}`);

    // Function to poll transaction status
    const pollTransactionStatus = async (invoiceID, retries = 20, delay = 20000) => {
      for (let i = 0; i < retries; i++) {
        try {
          const statusResponse = await collection.status(invoiceID);

          if (statusResponse && statusResponse.invoice) {
            const state = statusResponse.invoice.state;

            console.log(`Attempt ${i + 1}: Transaction State: ${state} for Invoice ID: ${invoiceID}`);

            if (state === "COMPLETE" || state === "FAILED") {
              console.log(statusResponse.meta.customer)
              return state;
            }
          }
        } catch (err) {
          console.error("Error fetching transaction status:", err);
        }

        await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
      }

      return "TIMEOUT"; // If no final state after retries
    };

    // Poll for status and send the final response
    const finalStatus = await pollTransactionStatus(invoiceID);
    res.json({ status: finalStatus });

  } catch (err) {
    console.error(`STK Push error:`, err);
    res.status(500).json({ error: "Error initiating payment" });
  }
});


app.post("/confirmstatus", (req, res) => {
  let intasend = new IntaSend(
    'ISPubKey_test_8e4361e2-3c73-402e-a581-1e1de0e9b1d9',
    'ISSecretKey_test_3240bffc-1d51-4568-9045-3c1487e2affb',
    true, // Test ? Set true for test environment
  );

  const transactionId = req.body.transactionId;

  let collection = intasend.collection();
  collection
     .status(transactionId) // the invoice id as it is returned from the stkpush function 
    .then((resp) => {
      // Redirect user to URL to complete payment
      // console.log(`Status Resp:`,resp);
      console.log(resp.invoice.state);
      if (resp.invoice.state == "FAIL") {
        res.send("Transaction Failed")

      } else if (resp.invoice.state == "COMPLETE") {
        // respond with a message to indicate a successfull transaction
        res.send("Success");
        
      } else {
        res.send("Transaction in Progress")
      }
    })
      .catch((err) => {
      console.error(`Status Resp error:`,err);
    });
});
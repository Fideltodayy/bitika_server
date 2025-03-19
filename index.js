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

app.get("/token", (req, res) => {
    getAccessToken();
})
// middleware function to get the access token
const getAccessToken = async (res, req, next) => {

    const consumerKey = process.env.CONSUMER_KEY
    const consumerSecret = process.env.CONSUMER_SECRET

    //choose one depending on you development environment
    const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"  //sandbox
    try {
   
        const encodedCredentials = new Buffer.from(consumerKey + ":" + consumerSecret).toString('base64');

        const headers = {
            'Authorization': "Basic" + " " + encodedCredentials,
            'Content-Type': 'application/json'
        }; 

        const response = await axios.get(url, { headers });
        console.log(response.data.access_token);
        token = response.data.access_token;
        next();
        } catch (error) {
        
        throw new Error('Failed to get access token.');
    }
}



app.post("/intasend", async (req, res) => {
  const amount = req.body.amount;
  const PhoneNumber = req.body.phoneNumber
  console.log(amount, PhoneNumber)
  try {
    const intasend = new IntaSend(
      "ISPubKey_test_8e4361e2-3c73-402e-a581-1e1de0e9b1d9",
      "ISSecretKey_test_3240bffc-1d51-4568-9045-3c1487e2affb",
      true // Test environment
    );

    const collection = intasend.collection();
    
    // Initiate MPESA STK Push
    const stkResponse = await collection.mpesaStkPush({
      first_name: "Joe",
      last_name: "Doe",
      email: "joe@doe.com",
      host: "https://yourwebsite.com",
      amount: amount,
      phone_number: "254112741449",
      api_ref: "test",
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

  let collection = intasend.collection();
  collection
     .status('RKM72EY') // the invoice id as it is returned from the stkpush function 
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


app.post("/stk", getAccessToken, async (req, res) => {
//   receive the phone number and amount from the request body
  const amount = req.body.amount;
  const phone = req.body.phone.substring(1);

  console.log(phone, amount);

  const date = new Date();
  const timestamp =
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours()).slice(-2) +
    ("0" + date.getMinutes()).slice(-2) +
    ("0" + date.getSeconds()).slice(-2);
    
    const shortCode = process.env.SHORT_CODE
    const passkey = process.env.PASSKEY
    
    const stk_password = new Buffer.from(shortCode + passkey + timestamp).toString(
      "base64"
    );
    //choose one depending on you development environment
    const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
   
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };
  
    const requestBody = {
      "BusinessShortCode": shortCode,
      "Password": stk_password,
      "Timestamp": timestamp,
      "TransactionType": "CustomerPayBillOnline", //till "CustomerBuyGoodsOnline"
      "Amount": amount,
      "PartyA": `254${phone}`,
      "PartyB": shortCode,
      "PhoneNumber": `254${phone}`,
      "CallBackURL": "https://a740-2c0f-2a80-239b-4210-98a4-6567-260d-d5/callbackurl",
      "AccountReference": `254${phone}`,
      "TransactionDesc": "test"
    };
  
    try {
      const response = await axios.post(url, requestBody, { headers });
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error(error);
    }
});

app.post("/callbackurl", (req, res) => {
  console.log(req.body.Body.stkCallback);
  if (!req.body.Body.stkCallback) {
    return res.status(400).send("Transaction failed");
  }

  console.log(req.body.Body.stkCallback.CallbackMetadata);
  const amount = req.body.Body.stkCallback.CallbackMetadata.Item[0].Value;
  const phone = req.body.Body.stkCallback.CallbackMetadata.Item[1].Value;
  const transactionId = req.body.Body.stkCallback.CallbackMetadata.Item[2].Value;

  console.log(amount, phone, transactionId);
  return res.status(200).send("Transaction successful");
});
const express = require("express");
const axios = require("axios");

const app = express();
require("dotenv").config();
const cors = require("cors");
  

// Create server first, then attach Express
const server = require('http').createServer(app);
// Initialize Socket.IO with the server
const io = require('socket.io')(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("<h1>Hello World!</h1>");
});

// Store connected socket clients
let connectedClients = [];

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  connectedClients.push(socket);
  
  socket.emit("converse", { message: "Welcome to the chat!" });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    connectedClients = connectedClients.filter(client => client.id !== socket.id);
  });
});

app.get("/token", (req, res) => {
  getAccessToken();
})
// middleware function to get the access token
const getAccessToken = async (res, req, next) => {

  const consumerKey = process.env.CONSUMER_KEY
  const consumerSecret = process.env.CONSUMER_SECRET

  //choose one depending on you development environment
  // const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"  //sandbox
  const url = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" //live

  try {
 
      const encodedCredentials = new Buffer.from(consumerKey + ":" + consumerSecret).toString('base64');

      const headers = {
          'Authorization': "Basic" + " " + encodedCredentials,
          'Content-Type': 'application/json'
      }; 

      const response = await axios.get(url, { headers });
      // console.log(response.data.access_token);
      token = response.data.access_token;
      next();
      } catch (error) {
      
      throw new Error('Failed to get access token.');
  }
}

app.post("/stk", getAccessToken, async (req, res) => {

// make sure the body contains amount and phone
if (!req.body.amount || !req.body.phone) {
  return res.status(400).send("Invalid request");
}

// receive the phone number and amount from the request body
const amount = req.body.amount;
const phone = req.body.phone;

// validate the phone number and amount
if (!amount || !phone) {
  return res.status(400).send("Invalid request");
}

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
  // const url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
  const url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

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
    "PartyA": phone,
    "PartyB": shortCode,
    "PhoneNumber": phone,
    // change this callback to the url of the hosted server
    "CallBackURL": "https://pmrzjwanq8.us-east-1.awsapprunner.com/callbackurl",
    "AccountReference": "BITIKA",
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


app.post('/callbackurl', (req, res) => {
  // Check the result code
  const result_code = req.body.Body.stkCallback.ResultCode;
  
  if (result_code !== 0) {
    // If the result code is not 0, there was an error
    const error_message = req.body.Body.stkCallback.ResultDesc;
    const response_data = { ResultCode: result_code, ResultDesc: error_message };
    console.log(response_data);
    
    // Broadcast to all connected clients
    io.emit('transaction', { status: "error", message: error_message });
    return res.json(response_data);
  }

  // If the result code is 0, the transaction was completed
  const body = req.body.Body.stkCallback.CallbackMetadata;

  // Get amount
  const amountObj = body.Item.find(obj => obj.Name === 'Amount');
  const amount = amountObj.Value;
  
  // Get Mpesa code
  const codeObj = body.Item.find(obj => obj.Name === 'MpesaReceiptNumber');
  const mpesaCode = codeObj.Value;

  // Get phone number
  const phoneNumberObj = body.Item.find(obj => obj.Name === 'PhoneNumber');
  const phone = phoneNumberObj.Value;

  console.log({amount, mpesaCode, phone});
  
  // Broadcast transaction success to all connected clients
  io.emit('transaction', { message: {amount, mpesaCode, phone}, status: "success" });
  
  // Return a success response to mpesa
  return res.json({ message: {amount, mpesaCode, phone}, status: "success" });
});

// Use only one port for the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


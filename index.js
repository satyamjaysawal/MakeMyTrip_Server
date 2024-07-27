const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

dotenv.config();

const authRoutes = require('./routes/auth');
const protectedRoutes = require('./routes/protectedRoute');
const Passenger = require('./Passenger'); 

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);

const FLIGHTS_FILE = path.join(__dirname, 'flights.json');
const HOTELS_FILE = path.join(__dirname, 'hotels.json');

// Database connection
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Define Payment Schema
const paymentSchema = new mongoose.Schema({
  hotel: String,
  roomClass: String,
  roomCount: Number,
  startDate: Date,
  endDate: Date,
  numberOfDays: Number,
  totalPrice: Number,
  customerName: String,
  email: String,
  phoneNumber: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
});

const Payment = mongoose.model('Payment', paymentSchema);

// Save passenger details
app.post('/save-passenger-details', async (req, res) => {
  const { flightDetails, name, age, gender, mobile, email, paymentMethod, mealPreference, travelInsurance } = req.body;

  const passenger = new Passenger({
    flightDetails,
    name,
    age,
    gender,
    bookingId: crypto.randomBytes(16).toString('hex'),
    mobile,
    email,
    paymentMethod,
    mealPreference,
    travelInsurance,
  });

  try {
    await passenger.save();
    res.status(201).json({ message: 'Passenger details saved successfully', passenger });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving passenger details', error });
  }
});

// Endpoint to fetch hotels
app.get('/hotels', (req, res) => {
  const { city, star_ratings, room_class } = req.query;

  fs.readFile(HOTELS_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading hotels file' });
    }

    let hotels = JSON.parse(data);

    if (city) {
      hotels = hotels.filter(hotel => hotel.city_name.toLowerCase() === city.toLowerCase());
    }

    if (star_ratings) {
      hotels = hotels.filter(hotel => hotel.star_ratings == star_ratings);
    }

    if (room_class) {
      hotels = hotels.map(hotel => {
        return {
          ...hotel,
          price_options: {
            [room_class]: hotel.price_options[room_class]
          }
        };
      });
    }

    res.json(hotels);
  });
});

// Fetch flights with optional query parameters
app.get('/flights', (req, res) => {
  fs.readFile(FLIGHTS_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error reading flights file');
    }

    const { from, to, departure_date, return_date, travellers_class, special_fare_option } = req.query;

    let flights = JSON.parse(data);

    flights = flights.filter(flight => {
      return (
        (!from || flight.from.toLowerCase() === from.toLowerCase()) &&
        (!to || flight.to.toLowerCase() === to.toLowerCase()) &&
        (!departure_date || flight.departure_date === departure_date) &&
        (!return_date || flight.return_date === return_date) &&
        (!travellers_class || flight.travellers.class.toLowerCase() === travellers_class.toLowerCase()) &&
        (!special_fare_option || flight.special_fare_option.hasOwnProperty(special_fare_option))
      );
    });

    if (special_fare_option) {
      flights = flights.map(flight => ({
        ...flight,
        fare: flight.special_fare_option[special_fare_option]
      }));
    }

    res.send(flights);
  });
});


// Add new flight
app.post('/flights', (req, res) => {
  const newFlight = req.body;

  fs.readFile(FLIGHTS_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error reading flights file');
    }

    const flights = JSON.parse(data);
    flights.push(newFlight);

    fs.writeFile(FLIGHTS_FILE, JSON.stringify(flights, null, 2), (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error writing flights file');
      }
      res.send(newFlight);
    });
  });
});

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order
app.post('/order', async (req, res) => {
  const { amount, currency, receipt } = req.body;

  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
    });

    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error creating order' });
  }
});

// Validate Payment and Save Payment Details
app.post('/validate', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentDetails } = req.body;

  const sha = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = sha.digest('hex');

  if (digest !== razorpay_signature) {
    return res.status(400).json({ msg: 'Transaction is not legit!' });
  }

  const payment = new Payment({
    ...paymentDetails,
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  try {
    await payment.save();
    res.json({ msg: 'Transaction is legit!', orderId: razorpay_order_id, paymentId: razorpay_payment_id });
  } catch (error) {
    console.error('Error saving payment details:', error);
    res.status(500).json({ error: 'Failed to save payment details' });
  }
});

// Email sending endpoint
app.post('/send-mail', async (req, res) => {
  const { email, name, flightDetails } = req.body;

  try {
    let transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Flight Booking Confirmation -- Dummy Test Mail',
      text: `Hello ${name}, your flight from ${flightDetails.from} to ${flightDetails.to} has been booked successfully.`,
      html: `<h1>Booking Confirmation -- Dummy Test Mail </h1><p>Hello ${name},</p><p>Your flight from ${flightDetails.from} (${flightDetails.fromAirport}) to ${flightDetails.to} (${flightDetails.toAirport}) on ${flightDetails.date} has been booked successfully.</p>`,
    });

    console.log('Message sent: %s', info.messageId);
    res.status(200).send({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send({ error: 'Failed to send email' });
  }
});


// Email sending endpoint for hotel bookings
app.post('/send-hotel-mail', async (req, res) => {
  const { email, customerName, hotel, roomClass, roomCount, startDate, endDate, numberOfDays, totalPrice } = req.body;

  try {
    let transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Hotel Booking Confirmation --Dummy Test Mail',
      text: `Hello ${customerName}, your hotel booking at ${hotel} has been confirmed. Room Class: ${roomClass}, Room Count: ${roomCount}, Start Date: ${startDate}, End Date: ${endDate}, Total Price: ₹${totalPrice}.`,
      html: `<h1>Booking Confirmation -- Dummy Test Mail</h1>
             <p>Hello ${customerName},</p>
             <p>Your hotel booking at <strong>${hotel}</strong> has been confirmed.</p>
             <p>Room Class: ${roomClass}<br/>
             Room Count: ${roomCount}<br/>
             Start Date: ${startDate}<br/>
             End Date: ${endDate}<br/>
             Number of Days: ${numberOfDays}<br/>
             Total Price: ₹${totalPrice}</p>`,
    });

    console.log('Message sent: %s', info.messageId);
    res.status(200).send({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send({ error: 'Failed to send email' });
  }
});


// Default route
app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  flightDetails: {
    from: String,
    fromAirport: String,
    to: String,
    toAirport: String,
    date: String,
  },
  name: String,
  age: Number,
  gender: String,
  bookingId: String,
  mobile: String,
  email: String,
  paymentMethod: String,
  mealPreference: String,
  travelInsurance: Boolean,
});

const Passenger = mongoose.model('Passenger', passengerSchema);

module.exports = Passenger;

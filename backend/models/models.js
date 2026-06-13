const mongoose = require('mongoose');


const customerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  phone: { type: String, required: true, index: true },
  city: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  tags: { type: [String], default: [] },
  lifetime_value: { type: Number, default: 0 },
  last_purchase_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});


const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  customer_id: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true, default: 'COMPLETED' },
  channel: { type: String, required: true }, 
  product_category: { type: String, required: true },
  created_at: { type: Date, required: true, default: Date.now }
});


const segmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  filter_json: { type: mongoose.Schema.Types.Mixed, required: true },
  snapshot_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});


const campaignSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  segment_id: { type: String, required: true, index: true },
  channel: { type: String, required: true, enum: ['whatsapp', 'sms', 'email', 'rcs'] },
  message_template: { type: String, required: true },
  schedule_time: { type: Date, default: null },
  status: { type: String, required: true, enum: ['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED'], default: 'DRAFT' },
  created_at: { type: Date, default: Date.now }
});


const communicationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  campaign_id: { type: String, required: true, index: true },
  customer_id: { type: String, required: true, index: true },
  recipient: { type: String, required: true },
  channel: { type: String, required: true },
  message: { type: String, required: true },
  status: { 
    type: String, 
    required: true, 
    enum: ['QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'READ', 'CLICKED', 'FAILED'], 
    default: 'QUEUED' 
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  error_message: { type: String, default: null }
});


communicationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

const Customer = mongoose.model('Customer', customerSchema);
const Order = mongoose.model('Order', orderSchema);
const Segment = mongoose.model('Segment', segmentSchema);
const Campaign = mongoose.model('Campaign', campaignSchema);
const Communication = mongoose.model('Communication', communicationSchema);

module.exports = {
  Customer,
  Order,
  Segment,
  Campaign,
  Communication
};

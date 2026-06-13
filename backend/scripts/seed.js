const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const dotenv = require('dotenv');
const { Customer, Order, Segment, Campaign, Communication } = require('../models/models');

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/xeno_crm');
    console.log('MongoDB Connected for Seeding...');
  } catch (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
};

// Curated lists for Indian Demographic profiles
const firstNames = [
  'Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Priya', 'Aditya', 'Sai', 'Rahul', 'Arjun',
  'Amit', 'Rajesh', 'Sanjay', 'Sneha', 'Neha', 'Pooja', 'Rohan', 'Karan', 'Deepak', 'Jyoti',
  'Vikram', 'Divya', 'Kiran', 'Nisha', 'Sunita', 'Manish', 'Harish', 'Preeti', 'Swati', 'Alok',
  'Pranav', 'Ritu', 'Anita', 'Vijay', 'Shweta', 'Meera', 'Ramesh', 'Suresh', 'Anil', 'Gita'
];

const lastNames = [
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Rao', 'Reddy', 'Nair', 'Joshi',
  'Mehta', 'Mishra', 'Prasad', 'Das', 'Roy', 'Sen', 'Banerjee', 'Chatterjee', 'Iyer', 'Pillai',
  'Deshmukh', 'Kulkarni', 'Bose', 'Menon', 'Shah', 'Trivedi', 'Yadav', 'Choudhury', 'Nair', 'Soni'
];

const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Kolkata', 'Chennai', 'Pune', 'Hyderabad', 'Ahmedabad'];

const categories = ['Electronics', 'Apparel', 'Groceries', 'Beauty', 'Home & Kitchen', 'Books'];
const channels = ['Web', 'App', 'In-Store'];
const tagsList = ['VIP', 'Festive Buyer', 'Churn Risk', 'Frequent Shopper', 'App User', 'Discounter', 'Weekend Shopper'];

async function seed() {
  await connectDB();

  try {
    // Clear existing collections
    console.log('Clearing existing database collections...');
    await Customer.deleteMany({});
    await Order.deleteMany({});
    await Segment.deleteMany({});
    await Campaign.deleteMany({});
    await Communication.deleteMany({});

    console.log('Seeding customers and orders...');

    const customers = [];
    const orders = [];

    // 1. Generate 500 customers
    for (let i = 0; i < 500; i++) {
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${fName} ${lName}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.in`;
      
      // Indian mobile phone format starting with +91 and 10 digits
      const phone = `+91 ${9000000000 + Math.floor(Math.random() * 1000000000)}`;
      const city = cities[Math.floor(Math.random() * cities.length)];
      const age = Math.floor(Math.random() * (65 - 18) + 18);
      const gender = Math.random() > 0.45 ? (Math.random() > 0.5 ? 'Female' : 'Male') : (Math.random() > 0.1 ? 'Male' : 'Female'); // Balanced
      
      // Random tags (0 to 3 tags)
      const tags = [];
      const numTags = Math.floor(Math.random() * 4);
      while (tags.length < numTags) {
        const t = tagsList[Math.floor(Math.random() * tagsList.length)];
        if (!tags.includes(t)) tags.push(t);
      }

      const id = `cust_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      
      customers.push({
        id,
        name,
        email,
        phone,
        city,
        age,
        gender,
        tags,
        lifetime_value: 0,
        last_purchase_at: null,
        created_at: faker.date.between({ from: '2025-01-01', to: '2026-02-01' })
      });
    }

    // Save customers
    await Customer.insertMany(customers);
    console.log('500 Customers Inserted!');

    // 2. Generate 2000 orders mapped to customers
    console.log('Generating 2000 orders...');
    for (let j = 0; j < 2000; j++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      
      const id = `ord_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      const amount = Math.floor(Math.random() * (15000 - 100) + 100);
      const status = Math.random() < 0.90 ? 'COMPLETED' : (Math.random() > 0.5 ? 'PENDING' : 'REFUNDED');
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const product_category = categories[Math.floor(Math.random() * categories.length)];
      
      // Order created in the last 120 days
      const created_at = faker.date.between({ from: '2026-02-12', to: '2026-06-12' });

      orders.push({
        id,
        customer_id: customer.id,
        amount,
        status,
        channel,
        product_category,
        created_at
      });
    }

    // Save orders
    await Order.insertMany(orders);
    console.log('2000 Orders Inserted!');

    // 3. Recalculate LTV and Last Purchase Date for all customers
    console.log('Calculating Customer lifetime values and last purchase dates...');
    const allCustomers = await Customer.find({});
    
    for (let c of allCustomers) {
      const customerOrders = orders.filter(o => o.customer_id === c.id && o.status === 'COMPLETED');
      
      if (customerOrders.length > 0) {
        const ltv = customerOrders.reduce((sum, o) => sum + o.amount, 0);
        
        // Find most recent order date
        let latestDate = null;
        customerOrders.forEach(o => {
          if (!latestDate || o.created_at > latestDate) {
            latestDate = o.created_at;
          }
        });

        c.lifetime_value = ltv;
        c.last_purchase_at = latestDate;
        
        // Auto assign VIP tag if LTV is high
        if (ltv > 15000 && !c.tags.includes('VIP')) {
          c.tags.push('VIP');
        }
        
        await c.save();
      }
    }

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding process:', error);
    process.exit(1);
  }
}

seed();

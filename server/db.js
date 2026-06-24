import mongoose from 'mongoose';
import ClinicConfig from './models/ClinicConfig.js';

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/queuedoc';
    await mongoose.connect(uri);

    console.log('MongoDB connected successfully');

    const config = await ClinicConfig.findById('config');

    if (!config) {
      await ClinicConfig.create({
        _id: 'config',
        avg_consultation_seconds: 300
      });
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}
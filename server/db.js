import mongoose from 'mongoose';
import ClinicConfig from './models/ClinicConfig.js';

export async function connectDB() {
    try {
        await mongoose.connect('mongodb://localhost:27017/queuedoc');
        console.log('MongoDB connected successfully');
        
        // Initialize config if it doesn't exist
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

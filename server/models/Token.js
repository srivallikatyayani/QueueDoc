import mongoose from 'mongoose';

const TokenSchema = new mongoose.Schema({
    token_number: Number,
    name: String,
    phone: String,
    priority: {
        type: String,
        default: "normal"
    },
    status: {
        type: String,
        default: "waiting"
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    called_at: Date,
    completed_at: Date,
    clinic_day: String
});

export default mongoose.model("Token", TokenSchema);
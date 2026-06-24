import mongoose from 'mongoose';

const ClinicConfigSchema = new mongoose.Schema({
    _id: String,
    avg_consultation_seconds: {
        type: Number,
        default: 300
    },
    global_delay_seconds: {
        type: Number,
        default: 0
    }
});

export default mongoose.model("ClinicConfig", ClinicConfigSchema);

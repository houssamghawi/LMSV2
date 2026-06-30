import mongoose, { Schema } from "mongoose";

const paymentSchema = new Schema({
    // User and Course references
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    course: {
        type: Schema.Types.ObjectId,
        ref: "Course",
        required: true,
        index: true
    },
    
    // Payment provider identifiers (flexible for different providers)
    // For Stripe: sessionId, paymentIntentId, customerId
    // For MockPay: referenceId
    sessionId: {
        type: String,
        required: false, // Optional - only used for Stripe payments
        index: true,
        sparse: true
    },
    paymentIntentId: {
        type: String,
        index: true
    },
    customerId: {
        type: String,
        index: true
    },
    referenceId: {
        type: String,
        unique: true,
        sparse: true, // Only required for mockpay
        index: true
    },
    
    // Payment details
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: "USD"
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'canceled'],
        default: 'pending',
        index: true
    },
    
    // Provider info
    provider: {
        type: String,
        required: true,
        enum: ['stripe', 'mockpay'],
        default: 'stripe',
        index: true
    },
    
    // Metadata
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    
    // Refund info
    refundedAmount: {
        type: Number,
        default: 0
    },
    refundReason: {
        type: String
    },
    
    // Timestamps
    paidAt: {
        type: Date
    },
    refundedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for user-course queries
paymentSchema.index({ user: 1, course: 1 });

// Index for status queries
paymentSchema.index({ status: 1, createdAt: -1 });

// Compound index for provider-specific lookups
paymentSchema.index({ provider: 1, referenceId: 1 }, { sparse: true });
paymentSchema.index({ provider: 1, sessionId: 1 }, { sparse: true });

// Update updatedAt on save
paymentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export const Payment = mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);

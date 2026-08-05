import mongoose, { Schema } from "mongoose";

const userActivityLogSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
  },
  action: {
    type: String,
    enum: ["login", "logout"],
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  sessionDuration: {
    type: Number,
    required: false,
  },
  ipAddress: {
    type: String,
    required: false,
  },
  userAgent: {
    type: String,
    required: false,
  },
  /** Soft-archive marker (FR-022). null/missing = included in standard analytics. */
  archivedAt: {
    type: Date,
    required: false,
    default: null,
  },
});

userActivityLogSchema.index({ user: 1, timestamp: -1 });
userActivityLogSchema.index({ timestamp: -1 });
userActivityLogSchema.index({ action: 1, timestamp: -1 });

export const UserActivityLog =
  mongoose.models.UserActivityLog ??
  mongoose.model("UserActivityLog", userActivityLogSchema);

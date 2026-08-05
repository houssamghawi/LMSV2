import mongoose, { Schema } from "mongoose";

const widgetConfigSchema = new Schema(
  {
    id: { type: String, required: true },
    position: { type: Number, required: true, default: 0 },
    size: {
      type: String,
      enum: ["small", "medium", "large"],
      default: "medium",
    },
    visible: { type: Boolean, default: true },
  },
  { _id: false }
);

const dashboardPreferenceSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    ref: "User",
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "instructor"],
    required: true,
  },
  layout: {
    type: [widgetConfigSchema],
    default: [],
  },
  defaultDateRange: {
    type: String,
    enum: ["7d", "30d", "90d", "custom"],
    default: "30d",
  },
  customDateRange: {
    start: { type: Date, required: false },
    end: { type: Date, required: false },
  },
  hiddenWidgets: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

dashboardPreferenceSchema.index({ user: 1, role: 1 }, { unique: true });

dashboardPreferenceSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const DashboardPreference =
  mongoose.models.DashboardPreference ??
  mongoose.model("DashboardPreference", dashboardPreferenceSchema);

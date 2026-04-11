const mongoose = require('mongoose');

const StreamAlertSubscriptionSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  platform: { type: String, required: true, enum: ['twitch', 'youtube', 'kick'], index: true },
  handle: { type: String, required: true },
  displayName: { type: String, default: null },
  externalId: { type: String, default: null },
  profileUrl: { type: String, default: null },
  enabled: { type: Boolean, default: true, index: true },
  lastKnownLive: { type: Boolean, default: false },
  lastSessionId: { type: String, default: null },
  lastTitle: { type: String, default: null },
  lastStartedAt: { type: Date, default: null },
  lastNotifiedAt: { type: Date, default: null },
  lastCheckedAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  createdBy: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'stream_alert_subscriptions',
});

StreamAlertSubscriptionSchema.index({ guildId: 1, platform: 1, handle: 1 }, { unique: true });
StreamAlertSubscriptionSchema.index(
  { guildId: 1, platform: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);
StreamAlertSubscriptionSchema.index({ enabled: 1, guildId: 1 });

module.exports = mongoose.models.StreamAlertSubscription || mongoose.model('StreamAlertSubscription', StreamAlertSubscriptionSchema);

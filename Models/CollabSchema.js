const mongoose = require('mongoose');

const CollabSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['config', 'request'],
        default: 'request',
        index: true,
    },
    guildID: { type: String, required: true, index: true },
    guildName: { type: String, default: null },

    // Config
    enabled: { type: Boolean, default: false },
    channelID: { type: String, default: null },
    staffRoleID: { type: String, default: null },

    // Request
    requestId: { type: String, default: null },
    authorID: { type: String, default: null, index: true },
    authorTag: { type: String, default: null },
    category: { type: String, default: 'other' },
    title: { type: String, default: null },
    description: { type: String, default: null },
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'cancelled', 'completed'],
        default: 'pending',
        index: true,
    },
    reviewerID: { type: String, default: null },
    reviewerTag: { type: String, default: null },
    reason: { type: String, default: null },

    messageID: { type: String, default: null },
    messageChannelID: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
}, {
    collection: 'collabs',
});

CollabSchema.index({ guildID: 1, type: 1 });
CollabSchema.index({ guildID: 1, type: 1, requestId: 1 }, { unique: true, sparse: true });
CollabSchema.index({ guildID: 1, type: 1, messageID: 1 }, { sparse: true });
CollabSchema.index({ guildID: 1, type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Collab', CollabSchema);

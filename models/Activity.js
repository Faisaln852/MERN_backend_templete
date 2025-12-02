const mongoose = require("mongoose")

// Define the Activity schema
const activitySchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true,
        },
        pathname: {
            type: String,
            required: true,
            trim: true,
            index: true, // Index for faster queries on popular pages
        },
        method: {
            type: String,
            required: true,
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
            uppercase: true,
        },
        userAgent: {
            type: String,
            required: true,
        },
        referer: {
            type: String,
            default: "",
        },
        ip: {
            type: String,
            required: true,
            index: true, // Index for IP-based queries
        },
        timestamp: {
            type: Date,
            required: true,
            index: true, // Index for time-based queries
        },
        searchParams: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        headers: {
            accept: {
                type: String,
                default: "",
            },
            acceptLanguage: {
                type: String,
                default: "",
            },
        },
        // Additional useful fields
        sessionId: {
            type: String,
            index: true, // For session tracking
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true, // For user-specific analytics
        },
        deviceType: {
            type: String,
            enum: ["mobile", "desktop", "tablet", "unknown"],
            default: "unknown",
        },
        browser: {
            type: String,
            default: "unknown",
        },
        os: {
            type: String,
            default: "unknown",
        },
        country: {
            type: String,
            default: "unknown",
        },
        city: {
            type: String,
            default: "unknown",
        },
        responseTime: {
            type: Number, // in milliseconds
            min: 0,
        },
        statusCode: {
            type: Number,
            min: 100,
            max: 599,
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt automatically
        collection: "activities", // Explicit collection name
    },
)

// Compound indexes for common queries
activitySchema.index({ timestamp: -1, pathname: 1 }) // Recent activities by page
activitySchema.index({ ip: 1, timestamp: -1 }) // Activities by IP over time
activitySchema.index({ method: 1, timestamp: -1 }) // Activities by method over time
activitySchema.index({ deviceType: 1, timestamp: -1 }) // Device analytics

// Virtual for checking if request is from mobile
activitySchema.virtual("isMobile").get(function () {
    return this.deviceType === "mobile" || this.userAgent.toLowerCase().includes("mobile")
})

// Static methods for analytics
activitySchema.statics.getActivityStats = async function (startDate, endDate) {
    const pipeline = [
        {
            $match: {
                timestamp: {
                    $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000), // Default: last 24 hours
                    $lte: endDate || new Date(),
                },
            },
        },
        {
            $group: {
                _id: null,
                totalActivities: { $sum: 1 },
                uniqueIPs: { $addToSet: "$ip" },
                uniquePages: { $addToSet: "$pathname" },
                methods: { $push: "$method" },
                deviceTypes: { $push: "$deviceType" },
            },
        },
        {
            $project: {
                totalActivities: 1,
                uniqueIPCount: { $size: "$uniqueIPs" },
                uniquePageCount: { $size: "$uniquePages" },
                methodDistribution: {
                    $reduce: {
                        input: "$methods",
                        initialValue: {},
                        in: {
                            $mergeObjects: [
                                "$$value",
                                {
                                    $arrayToObject: [
                                        [
                                            {
                                                k: "$$this",
                                                v: { $add: [{ $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] }, 1] },
                                            },
                                        ],
                                    ],
                                },
                            ],
                        },
                    },
                },
                deviceDistribution: {
                    $reduce: {
                        input: "$deviceTypes",
                        initialValue: {},
                        in: {
                            $mergeObjects: [
                                "$$value",
                                {
                                    $arrayToObject: [
                                        [
                                            {
                                                k: "$$this",
                                                v: { $add: [{ $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] }, 1] },
                                            },
                                        ],
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
        },
    ]

    const result = await this.aggregate(pipeline)
    return (
        result[0] || {
            totalActivities: 0,
            uniqueIPCount: 0,
            uniquePageCount: 0,
            methodDistribution: {},
            deviceDistribution: {},
        }
    )
}

activitySchema.statics.getHourlyActivity = async function (startDate, endDate) {
    const pipeline = [
        {
            $match: {
                timestamp: {
                    $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
                    $lte: endDate || new Date(),
                },
            },
        },
        {
            $group: {
                _id: { $hour: "$timestamp" },
                count: { $sum: 1 },
            },
        },
        {
            $sort: { _id: 1 },
        },
        {
            $project: {
                hour: { $concat: [{ $toString: "$_id" }, ":00"] },
                count: 1,
                _id: 0,
            },
        },
    ]

    return await this.aggregate(pipeline)
}

activitySchema.statics.getPopularPages = async function (limit = 10, startDate, endDate) {
    const pipeline = [
        {
            $match: {
                timestamp: {
                    $gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
                    $lte: endDate || new Date(),
                },
            },
        },
        {
            $group: {
                _id: "$pathname",
                count: { $sum: 1 },
                uniqueVisitors: { $addToSet: "$ip" },
            },
        },
        {
            $project: {
                path: "$_id",
                count: 1,
                uniqueVisitors: { $size: "$uniqueVisitors" },
                _id: 0,
            },
        },
        {
            $sort: { count: -1 },
        },
        {
            $limit: limit,
        },
    ]

    return await this.aggregate(pipeline)
}

// Instance methods
activitySchema.methods.parseUserAgent = function () {
    const ua = this.userAgent.toLowerCase()

    // Detect device type
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
        this.deviceType = "mobile"
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
        this.deviceType = "tablet"
    } else {
        this.deviceType = "desktop"
    }

    // Detect browser
    if (ua.includes("chrome")) {
        this.browser = "Chrome"
    } else if (ua.includes("firefox")) {
        this.browser = "Firefox"
    } else if (ua.includes("safari")) {
        this.browser = "Safari"
    } else if (ua.includes("edge")) {
        this.browser = "Edge"
    } else {
        this.browser = "Other"
    }

    // Detect OS
    if (ua.includes("windows")) {
        this.os = "Windows"
    } else if (ua.includes("mac")) {
        this.os = "macOS"
    } else if (ua.includes("linux")) {
        this.os = "Linux"
    } else if (ua.includes("android")) {
        this.os = "Android"
    } else if (ua.includes("ios")) {
        this.os = "iOS"
    } else {
        this.os = "Other"
    }

    return this
}

// Pre-save middleware to parse user agent
activitySchema.pre("save", function (next) {
    if (this.isNew || this.isModified("userAgent")) {
        this.parseUserAgent()
    }
    next()
})

// Create and export the model
const Activity = mongoose.model("Activity", activitySchema)

module.exports = Activity

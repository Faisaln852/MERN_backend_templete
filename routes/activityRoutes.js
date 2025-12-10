import express from "express";
import Activity from "../models/Activity.js"; // Make sure your model exports default

const router = express.Router();

// Middleware to validate API key (optional security)
const validateApiKey = (req, res, next) => {
    // Example: check API key in headers
    // if (req.headers["x-api-key"] !== process.env.API_KEY) {
    //     return res.status(401).json({ success: false, error: "Invalid API key" });
    // }
    next();
};

// Middleware to parse and validate activity data
const validateActivityData = (req, res, next) => {
    const { url, pathname, method } = req.body;

    if (!url || !pathname || !method) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: url, pathname, method",
            required: ["url", "pathname", "method"],
            optional: [
                "userAgent",
                "referer",
                "ip",
                "searchParams",
                "headers",
                "sessionId",
                "userId",
            ],
        });
    }

    const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];
    if (!validMethods.includes(method.toUpperCase())) {
        return res.status(400).json({
            success: false,
            error: "Invalid HTTP method",
            validMethods,
        });
    }

    next();
};

// POST /api/activity - Log a single activity
router.post("/", validateApiKey, validateActivityData, async (req, res) => {
    try {
        const activityData = {
            url: req.body.url,
            pathname: req.body.pathname,
            method: req.body.method.toUpperCase(),
            userAgent: req.body.userAgent || "Unknown",
            referer: req.body.referer || "",
            ip: req.body.ip || req.ip.replace("::ffff:", "") || "unknown",
            timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
            searchParams: req.body.searchParams || {},
            headers: {
                accept: req.body.headers?.accept || "",
                acceptLanguage: req.body.headers?.acceptLanguage || "",
            },
            sessionId: req.body.sessionId || null,
            userId: req.body.userId || null,
            responseTime: req.body.responseTime || null,
            statusCode: req.body.statusCode || 200,
            deviceType: req.body.deviceType || "unknown", // optional
        };

        const activity = new Activity(activityData);
        await activity.save();

        res.status(201).json({
            success: true,
            message: "Activity logged successfully",
            data: {
                id: activity._id,
                timestamp: activity.timestamp,
                pathname: activity.pathname,
                method: activity.method,
            },
        });
    } catch (error) {
        console.error("Error logging activity:", error);
        res.status(500).json({
            success: false,
            error: "Failed to log activity",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// POST /api/activity/batch - Log multiple activities at once
router.post("/batch", validateApiKey, async (req, res) => {
    try {
        const { activities } = req.body;

        if (!Array.isArray(activities) || activities.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Activities must be a non-empty array",
            });
        }

        if (activities.length > 100) {
            return res.status(400).json({
                success: false,
                error: "Maximum 100 activities allowed per batch",
            });
        }

        const validActivities = [];
        const invalidIndexes = [];

        activities.forEach((activity, index) => {
            if (!activity.url || !activity.pathname || !activity.method) {
                invalidIndexes.push(index);
                return;
            }
            validActivities.push({
                url: activity.url,
                pathname: activity.pathname,
                method: activity.method.toUpperCase(),
                userAgent: activity.userAgent || "Unknown",
                referer: activity.referer || "",
                ip: activity.ip || req.ip.replace("::ffff:", "") || "unknown",
                timestamp: activity.timestamp ? new Date(activity.timestamp) : new Date(),
                searchParams: activity.searchParams || {},
                headers: {
                    accept: activity.headers?.accept || "",
                    acceptLanguage: activity.headers?.acceptLanguage || "",
                },
                sessionId: activity.sessionId || null,
                userId: activity.userId || null,
                responseTime: activity.responseTime || null,
                statusCode: activity.statusCode || 200,
                deviceType: activity.deviceType || "unknown",
            });
        });

        if (invalidIndexes.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Some activities are invalid",
                invalidIndexes,
            });
        }

        const savedActivities = await Activity.insertMany(validActivities);

        res.status(201).json({
            success: true,
            message: `${savedActivities.length} activities logged successfully`,
            data: {
                count: savedActivities.length,
                ids: savedActivities.map((activity) => activity._id),
            },
        });
    } catch (error) {
        console.error("Error logging batch activities:", error);
        res.status(500).json({
            success: false,
            error: "Failed to log batch activities",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// GET /api/activity - Get activities with filtering and pagination
router.get("/", validateApiKey, async (req, res) => {
    try {
        const {
            limit = 50,
            offset = 0,
            startDate,
            endDate,
            method,
            pathname,
            ip,
            userId,
            sessionId,
            sortBy = "timestamp",
            sortOrder = "desc",
        } = req.query;

        const filter = {};

        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        if (method) filter.method = method.toUpperCase();
        if (pathname) {
            const safePathname = pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.pathname = new RegExp(safePathname, "i");
        }
        if (ip) filter.ip = ip;
        if (userId) filter.userId = userId;
        if (sessionId) filter.sessionId = sessionId;

        const sort = {};
        sort[sortBy] = sortOrder === "asc" ? 1 : -1;

        const activities = await Activity.find(filter)
            .sort(sort)
            .limit(Number(limit))
            .skip(Number(offset))
            .select("-__v");

        const total = await Activity.countDocuments(filter);

        res.json({
            success: true,
            data: {
                activities,
                pagination: {
                    total,
                    limit: Number(limit),
                    offset: Number(offset),
                    pages: Math.ceil(total / Number(limit)),
                    currentPage: Math.floor(Number(offset) / Number(limit)) + 1,
                },
                filters: filter,
            },
        });
    } catch (error) {
        console.error("Error fetching activities:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch activities",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// GET /api/activity/stats
router.get("/stats", validateApiKey, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = "day" } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const totalActivities = await Activity.countDocuments({ timestamp: { $gte: start, $lte: end } });
        const uniqueIPs = await Activity.distinct("ip", { timestamp: { $gte: start, $lte: end } });
        const uniquePages = await Activity.distinct("pathname", { timestamp: { $gte: start, $lte: end } });

        const methodStats = await Activity.aggregate([
            { $match: { timestamp: { $gte: start, $lte: end } } },
            { $group: { _id: "$method", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        const deviceStats = await Activity.aggregate([
            { $match: { timestamp: { $gte: start, $lte: end } } },
            { $group: { _id: "$deviceType", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        let timeGrouping;
        if (groupBy === "hour") timeGrouping = { $hour: "$timestamp" };
        else if (groupBy === "day") timeGrouping = { $dayOfYear: "$timestamp" };
        else if (groupBy === "month") timeGrouping = { $month: "$timestamp" };

        const timeStats = await Activity.aggregate([
            { $match: { timestamp: { $gte: start, $lte: end } } },
            { $group: { _id: timeGrouping, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        res.json({
            success: true,
            data: {
                summary: {
                    totalActivities,
                    uniqueIPs: uniqueIPs.length,
                    uniquePages: uniquePages.length,
                    period: { start, end },
                },
                methodDistribution: methodStats,
                deviceDistribution: deviceStats,
                timeDistribution: timeStats,
            },
        });
    } catch (error) {
        console.error("Error fetching activity stats:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch activity statistics",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// GET /api/activity/popular-pages
router.get("/popular-pages", validateApiKey, async (req, res) => {
    try {
        const { limit = 10, startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const popularPages = await Activity.aggregate([
            { $match: { timestamp: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: "$pathname",
                    visits: { $sum: 1 },
                    uniqueVisitors: { $addToSet: "$ip" },
                    lastVisit: { $max: "$timestamp" },
                },
            },
            {
                $project: {
                    pathname: "$_id",
                    visits: 1,
                    uniqueVisitors: { $size: "$uniqueVisitors" },
                    lastVisit: 1,
                    _id: 0,
                },
            },
            { $sort: { visits: -1 } },
            { $limit: Number(limit) },
        ]);

        res.json({ success: true, data: popularPages });
    } catch (error) {
        console.error("Error fetching popular pages:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch popular pages",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// GET /api/activity/user/:userId
router.get("/user/:userId", validateApiKey, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const activities = await Activity.find({ userId })
            .sort({ timestamp: -1 })
            .limit(Number(limit))
            .skip(Number(offset))
            .select("-__v");

        const total = await Activity.countDocuments({ userId });

        res.json({
            success: true,
            data: { userId, activities, total, limit: Number(limit), offset: Number(offset) },
        });
    } catch (error) {
        console.error("Error fetching user activities:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch user activities",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// DELETE /api/activity/cleanup
router.delete("/cleanup", validateApiKey, async (req, res) => {
    try {
        const { days = 30, dryRun = false } = req.query;
        const cutoffDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

        if (dryRun === "true") {
            const count = await Activity.countDocuments({ timestamp: { $lt: cutoffDate } });
            return res.json({
                success: true,
                message: `Would delete ${count} activities older than ${days} days`,
                dryRun: true,
                cutoffDate,
            });
        }

        const result = await Activity.deleteMany({ timestamp: { $lt: cutoffDate } });
        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} activities older than ${days} days`,
            deletedCount: result.deletedCount,
            cutoffDate,
        });
    } catch (error) {
        console.error("Error cleaning up activities:", error);
        res.status(500).json({
            success: false,
            error: "Failed to cleanup activities",
            details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
    }
});

// GET /api/activity/health
router.get("/health", async (req, res) => {
    try {
        await Activity.findOne(); // Check DB connection

        res.json({
            success: true,
            status: "healthy",
            timestamp: new Date().toISOString(),
            database: "connected",
            version: "1.0.0",
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            database: "disconnected",
            error: error.message,
        });
    }
});

export default router;

import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";

export const getAdminMetrics = async (req, res, next) => {
  try {
    const [totalUsers, totalSellers, orderSummary] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "seller" }),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentInfo.status", "Completed"] },
                  "$totalAmount",
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);
    const { totalOrders = 0, totalRevenue = 0 } = orderSummary[0] || {};

    const recentOrders = await Order.find()
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalUsers,
      totalSellers,
      totalOrders,
      totalRevenue,
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
};

export const getSellerMetrics = async (req, res, next) => {
  try {
    const sellerId = req.user._id;
    const orders = await Order.find({
      items: { $elemMatch: { seller: sellerId } },
      "paymentInfo.status": "Completed",
    }).sort({ createdAt: -1 });
    const sellerItems = orders.flatMap((order) =>
      order.items.filter((item) => String(item.seller) === String(sellerId)),
    );
    const totalSales = sellerItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    res.json({
      totalOrders: new Set(orders.map((order) => String(order._id))).size,
      totalSales,
      totalEarnings: Math.round(totalSales * 0.85),
      pendingOrders: orders.filter((o) => o.orderStatus === "Processing")
        .length,
      recentOrders: orders.slice(0, 5),
    });
  } catch (error) {
    next(error);
  }
};

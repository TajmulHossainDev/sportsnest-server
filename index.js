const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config();

const uri = process.env.MONGODB_URI;
const app = express();
const PORT = process.env.PORT;
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);


const verifyToken = async (req, res, next) => {
  let token = req.cookies?.auth_token;
  if (!token) {
    const authHeader = req?.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "unauthorized" });
    }
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({
      message: "Forbidden",
      error: error.message,
    });
  }
};

async function run() {
  try {
    const db = client.db("sportnest");
    const facilityCollection = db.collection("facilities");
    const bookingCollection = db.collection("bookings");
    app.post("/auth/set-cookie", (req, res) => {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Token required" });
      }
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ message: "Cookie set successfully" });
    });
    app.post("/auth/clear-cookie", (req, res) => {
      res.clearCookie("auth_token");
      res.json({ message: "Cookie cleared" });
    });
        app.get("/featured", async (req, res) => {
      const result = await facilityCollection.find().limit(6).toArray();
      res.json(result);
    });
    app.get("/facilities", async (req, res) => {
      const { search, type } = req.query;

      const query = {};

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      if (type && type !== "all") {
        query.facility_type = { $in: [type] };
      }

      const result = await facilityCollection.find(query).toArray();
      res.json(result);
    });
    app.get("/facilities/:id", async (req, res) => {
      const { id } = req.params;
      const result = await facilityCollection.findOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });
        app.post("/facilities", verifyToken, async (req, res) => {
      const facilityData = req.body;
      const result = await facilityCollection.insertOne(facilityData);
      res.json(result);
    });
    app.get("/my-facilities", verifyToken, async (req, res) => {
      const { email } = req.query;
      const result = await facilityCollection
        .find({ owner_email: email })
        .toArray();
      res.json(result);
    });
    app.patch("/facilities/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      const result = await facilityCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );
      res.json(result);
    });
    app.delete("/facilities/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await facilityCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });
        app.post("/bookings", verifyToken, async (req, res) => {
      const bookingData = req.body;
      const result = await bookingCollection.insertOne({
        ...bookingData,
        status: "pending",
      });
      res.json(result);
    });
    app.get("/bookings", verifyToken, async (req, res) => {
      const { email } = req.query;
      const result = await bookingCollection
        .find({ user_email: email })
        .toArray();
      res.json(result);
    });
    app.patch("/bookings/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "cancelled" } },
      );
      res.json(result);
    });
    app.delete("/bookings/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    console.log("Connected to MongoDB!");
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SportNest server is running...");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
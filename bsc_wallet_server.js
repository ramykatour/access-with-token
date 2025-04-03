import dotenv from "dotenv";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { body, validationResult } from "express-validator";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(morgan("combined"));
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

const validateAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);

app.post(
  "/verify",
  [
    body("address").custom((value) => {
      if (!validateAddress(value)) throw new Error("Invalid address");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { address } = req.body;
      const url = `https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${process.env.CONTRACT_ADDRESS}&address=${address}&tag=latest&apikey=${process.env.BSCSCAN_API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      if (data.status !== "1") throw new Error(data.message || "API error");

      const balance = parseFloat(data.result) / 1e18;
      res.json({ access: balance >= process.env.MIN_BALANCE });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

app.listen(port, () => console.log(`Server running on port ${port}`));

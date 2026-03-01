import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { identifyRouter } from "./routes/identify";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/identify", identifyRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

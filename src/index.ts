import express from "express";
import { identifyContact } from "./controllers/identify";

const app = express();
app.use(express.json());

app.post("/identify", identifyContact);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
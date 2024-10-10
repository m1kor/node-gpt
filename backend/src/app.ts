import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import openai from "openai";
import { AppDataSource } from "@/data-source";
import { Chat } from "@/entity/chat";
import { Message } from "@/entity/message";
import { Template } from "@/entity/template";
import { User } from "@/entity/user";
import { Workflow } from "@/entity/workflow";
import { hash } from "argon2";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const app = express();
const port = 80;

const upload = multer();
const openaiClient = new openai.OpenAI({ apiKey: "" });
const defaultUrl = openaiClient.baseURL;

AppDataSource.initialize().then(() => {
  app.listen(port, async () => {
    console.log("\x1b[32m" + "Init OK");
    console.log(`Server is running on port ${port}`);
  });
}).catch((err) => {
  console.error(err);
});

app.use(cors({
  origin: JSON.parse(process.env.ALLOWED_ORIGINS || "[]"),
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

app.use(async (req, res, next) => {
  let dmz = ["/api/login"];
  let session = req.cookies["session"];
  const user = await User.fromSession(session);
  if (user) {
    if (User.online[user.id]) {
      clearTimeout(User.online[user.id]);
    }
    User.online[user.id] = setTimeout(async () => {
      delete User.online[user.id];
    }, 600000);
  }
  if (!dmz.includes(req.path) && (!session || !user)) {
    res.status(401).send("Unauthorized");
  } else {
    next();
  }
});

app.post("/api/login", async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let user = await User.authenticate(username, password);
  if (user) {
    res.cookie("session", user.session);
    res.send({ "detail": "Logged in successfully." });
  } else {
    res.status(401).send("Unauthorized");
  }
});

app.get("/api/logout", async (req, res) => {
  let session = req.cookies["session"];
  let user = await User.fromSession(session);
  if (user) {
    user.session = null;
    await AppDataSource.getRepository(User).save(user);
    clearTimeout(User.online[user.id]);
    delete User.online[user.id];
    res.cookie("session", "");
    res.send({ "detail": "Logged out successfully." });
  } else {
    res.status(401).send("Unauthorized");
  }
});

app.post("/api/change-password", async (req, res) => {
  let session = req.cookies["session"];
  let user = await User.fromSession(session);
  if (user) {
    user.password = await hash(req.body.password);
    await AppDataSource.getRepository(User).save(user);
    res.send({ "detail": "Password changed successfully." });
  } else {
    res.status(401).send("Unauthorized");
  }
});

app.get("/api/me", async (req, res) => {
  let session = req.cookies["session"];
  let user = await User.fromSession(session);
  if (user) {
    res.send(user);
  } else {
    res.status(401).send("Unauthorized");
  }
});

app.get("/api/user_count", async (req, res) => {
  const count = await AppDataSource.getRepository(User).count();
  res.send({ active_users: Object.keys(User.online).length, total_users: count });
});

app.get("/api/workflows", async (req, res) => {
  const workflows = await AppDataSource.getRepository(Workflow).find();
  res.send(workflows.map(w => ({ id: w.id, title: w.title, type: "DIRECT" })));
});

app.get("/api/chats", async (req, res) => {
  const user = await User.fromSession(req.cookies["session"]);
  const chats = await AppDataSource.getRepository(Chat).find({ where: { user: user } });
  res.send(chats);
});

app.get("/api/chats/:id", async (req, res) => {
  const user = await User.fromSession(req.cookies["session"]);
  const chat = await AppDataSource.getRepository(Chat).findOne({
    where: { user: user, id: Number(req.params.id) },
    relations: ["messages", "messages.workflow"], order: { messages: { date_posted: "ASC" } }
  });
  const messages = chat?.messages.map(({ workflow, ...m }) => (Object.assign({}, m, { workflow_id: workflow?.id }))) || [];
  res.send(Object.assign({}, chat, { messages: messages, workflow_id: chat?.workflow?.id }));
});

app.delete("/api/chats/:id", async (req, res) => {
  const user = await User.fromSession(req.cookies["session"]);
  const chat = await AppDataSource.getRepository(Chat).findOne({
    where: { user: user, id: Number(req.params.id) },
    relations: ["user"]
  });
  if (chat?.user.id == user.id) {
    await AppDataSource.getRepository(Message).delete({ chat: chat });
    await AppDataSource.getRepository(Chat).remove(chat);
    res.send({ "detail": "Chat deleted successfully." });
  } else {
    res.status(404).send("Not Found");
  }
});

app.get("/api/templates", async (req, res) => {
  res.send(await AppDataSource.getRepository(Template).find());
});

app.post("/api/prompt", upload.none(), async (req, res) => {
  const user = await User.fromSession(req.cookies["session"]);
  let chat_id = req.body.chat_id;
  let workflow_id = req.body.workflow_id;
  let content = req.body.content;
  let workflow = await AppDataSource.getRepository(Workflow).findOne({ where: { id: workflow_id } });
  if (workflow) {
    let chat = await AppDataSource.getRepository(Chat).findOne({ where: { id: chat_id }, relations: ["user"] });
    if (chat && chat.user.id !== user.id) {
      res.status(403).send("Forbidden");
    } else {
      if (!chat) {
        chat = new Chat();
        chat.title = "新規作成";
        chat.messages = [];
        chat.user = user;
        await AppDataSource.getRepository(Chat).save(chat);
      }
      let message = new Message();
      message.content = content;
      message.date_posted = new Date();
      message.role = "user";
      message.workflow = workflow;
      message.chat = chat;
      await AppDataSource.getRepository(Message).save(message);
      res.send({
        "chat_id": chat.id,
        "title": chat.title,
        "message_id": message.id,
        "date_posted": message.date_posted,
      });
    }
  } else {
    res.status(400).send("Bad Request");
  }
});

function preprocess(content: string): string {
  const lines = content.split("\n");
  let inMultilineCodeBlock = false;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inMultilineCodeBlock = !inMultilineCodeBlock;
    } else if (!inMultilineCodeBlock) {
      inCodeBlock = inCodeBlock !== ((line.split("`").length - 1) % 2 == 1);
    }
  }

  // If we still end up inside a code block, close it
  if (inMultilineCodeBlock) {
    return content + "\n```";
  } else if (inCodeBlock) {
    return content + "`";
  } else {
    return content;
  }
}

app.get("/api/stream/:id", async (req, res) => {
  const user = await User.fromSession(req.cookies["session"]);
  const chat = await AppDataSource.getRepository(Chat).findOne({
    where: { user: user, id: Number(req.params.id) },
    relations: ["messages", "messages.workflow"], order: { messages: { date_posted: "ASC" } }
  });
  const workflow = chat?.workflow;
  if (workflow) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    openaiClient.baseURL = workflow.url || defaultUrl;
    openaiClient.apiKey = workflow.apiKey;

    const messages: Array<ChatCompletionMessageParam> = chat?.messages.map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content, name: null
    })) || [];
    const completion = await openaiClient.chat.completions.create({ model: workflow.model, messages: messages, stream: true });
    let content = "";
    let aborted = false;
    res.on("close", () => {
      completion.controller.abort();
      aborted = true;
      res.end();
    });
    for await (const chunk of completion) {
      const incomingMessage = chunk.choices[0]?.delta?.content || '';
      content += incomingMessage;
      res.write(`event: append\ndata: ${JSON.stringify({ content: preprocess(content) })}\n\n`);
    }
    let message = new Message();
    message.content = aborted ? preprocess(content) + "..." : content;
    message.date_posted = new Date();
    message.role = "assistant";
    message.workflow = workflow;
    message.chat = chat;
    if (!aborted && chat.messages.length == 1) {
      const title_prompt = `Summarize the following conversation in 5 words or less:\n\n${chat.messages[0].content}\n\n${message.content}`;
      const title_completion = await openaiClient.chat.completions.create({
        model: workflow.model,
        messages:
          [{ role: "system", content: workflow.systemPrompt, name: null },
          { role: "user", content: title_prompt, name: null }],
        max_tokens: 10
      });
      chat.title = title_completion.choices[0].message.content;
      await AppDataSource.getRepository(Chat).save(chat);
      res.write(`event: title\ndata: ${chat.title}\n\n`);
    }
    await AppDataSource.getRepository(Message).save(message);
    if (!aborted) {
      res.write(`event: id\ndata: ${message.id}\n\n`);
      res.write("event: end\ndata: \n\n");
      res.end();
    }
  } else {
    res.status(404).send("Not Found");
  }
});

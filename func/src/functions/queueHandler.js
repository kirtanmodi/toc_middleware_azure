const { app } = require("@azure/functions");

app.serviceBusQueue("queueHandler", {
  connection: "servicebus",
  queueName: "dev-toc-middleware-sb-queue",
  handler: (message, context) => {
    context.log("Service bus queue function processed message:", message);
  },
});

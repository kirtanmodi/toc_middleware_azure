const { app } = require("@azure/functions");

app.serviceBusQueue("queueTrigger", {
  connection: process.env["servicebus__fullyQualifiedNamespace"],
  queueName: process.env["serviceBusQueueName"],
  handler: (message, context) => {
    context.log("Service bus queue function processed message:", message);
  },
});

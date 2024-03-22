const { app } = require("@azure/functions");

app.serviceBusQueue("queueTrigger", {
  connection: "servicebus",
  queueName: process.env["servicebus__queueName"],
  handler: (message, context) => {
    context.log("Service bus queue function processed message:", message);
  },
});

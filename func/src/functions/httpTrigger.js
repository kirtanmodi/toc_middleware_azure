const { app } = require("@azure/functions");
const { ServiceBusClient } = require("@azure/service-bus");
const { DefaultAzureCredential } = require("@azure/identity");
const stream = require("stream");

app.http("httpTrigger", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    context.log(`Received message from httpTrigger`);
    context.log(
      `process.env["servicebus__fullyQualifiedNamespace"]: ${process.env["servicebus__fullyQualifiedNamespace"]}`
    );
    context.log(
      `process.env["servicebus__clientID"]: ${process.env["servicebus__clientID"]}`
    );
    context.log(
      `process.env["serviceBusQueueName"]: ${process.env["serviceBusQueueName"]}`
    );
    const readStream = stream.Readable.from(request.body);
    let message = "";
    await new Promise((resolve, reject) => {
      readStream.on("data", (chunk) => {
        message = Buffer.concat([Buffer.from(message), chunk]);
      });
      readStream.on("end", resolve);
      readStream.on("error", reject);
    });
    const finalMessage = message.toString();
    context.log(`Received message: ${finalMessage}`);

    const sbClient = new ServiceBusClient(
      process.env["servicebus__fullyQualifiedNamespace"],
      new DefaultAzureCredential({
        managedIdentityClientId: process.env["servicebus__clientID"],
      })
    );

    const sender = sbClient.createSender(process.env["serviceBusQueueName"]);

    try {
      await sender.sendMessages({
        body: finalMessage,
      });

      context.res = {
        body: "Message sent to the queue successfully.",
      };
    } catch (err) {
      context.log(`Exception: ${err}`);
      context.res = {
        status: 500,
        body: `Failed to send message: ${err.message}`,
      };
    } finally {
      await sender.close();
      await sbClient.close();
    }
  },
});

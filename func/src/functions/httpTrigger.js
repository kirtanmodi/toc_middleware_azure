const { app } = require("@azure/functions");
const { ServiceBusClient } = require("@azure/service-bus");
const { DefaultAzureCredential } = require("@azure/identity");
const stream = require("stream");

app.http("httpTrigger", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    context.log(`Received message from httpTrigger`);
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
      "dev-toc-middleware-sb-namespace.servicebus.windows.net",
      new DefaultAzureCredential({
        managedIdentityClientId: "04988f23-9c1d-4c9d-9e01-004a1e761b2c",
      })
    );

    const sender = sbClient.createSender("dev-toc-middleware-sb-queue");

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

const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { v4: uuidv4 } = require("uuid");

app.serviceBusQueue("queueTrigger", {
  connection: "servicebus",
  queueName: process.env["serviceBusQueueName"],
  handler: async (message, context) => {
    context.log("Service bus queue function processed message:", message);

    await updateDatabase(message, context).catch((error) => {
      context.log("An error occurred in updateDatabase:", error);
    });
  },
});

const updateDatabase = async (message, context) => {
  const azureCredential = new DefaultAzureCredential({
    managedIdentityClientId: process.env["cosmosdb__clientID"],
  });

  const cosmosDbEndpoint = process.env["cosmosdb__endpoint"];
  const cosmosClient = new CosmosClient({
    endpoint: cosmosDbEndpoint,
    aadCredentials: azureCredential,
  });

  const database = cosmosClient.database(process.env["cosmosdb__database"]);
  const container = database.container(process.env["cosmosdb__container"]);

  try {
    const messageData =
      typeof message === "string" ? JSON.parse(message) : message;

    const itemToUpsert = {
      orderId: messageData.data?.id,
      ProcessedAt: new Date().getTime(),
    };

    const { resource: upsertedItem } = await container.items.upsert(
      itemToUpsert
    );
    context.log("Item upserted successfully:", upsertedItem.id);
  } catch (error) {
    context.log("An error occurred while processing the message:", error);
    throw error;
  }
};

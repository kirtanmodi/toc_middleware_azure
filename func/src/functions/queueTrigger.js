const { app } = require("@azure/functions");
const { CosmosClient } = require("@azure/cosmos");
const { DefaultAzureCredential } = require("@azure/identity");
const { v4: uuidv4 } = require("uuid");
// const BigCommerce = require("node-bigcommerce");
const { Connection, Request, TYPES } = require("tedious");

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
  const messageData = typeof message === "string" ? JSON.parse(message) : message;

  const orderId = messageData.data?.id.toString().trim();
  context.log("BC_orderid value:", orderId.toString().trim());

  if (!orderId) {
    throw new Error("Order ID is missing in the message data");
  }

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

  const sqlServerName = process.env["SQLServerName"];
  const databaseName = process.env["SQLDatabaseName"];

  context.log("SQL Server Name:", sqlServerName);
  context.log("SQL Database Name:", databaseName);

  const config = {
    server: sqlServerName,
    authentication: {
      type: "default",
      options: {
        userName: "sqlAdmin",
        password: "Sql123456",
      },
    },
    options: {
      database: databaseName,
      encrypt: true,
    },
  };

  const connection = new Connection(config);
  connection.on("connect", (err) => {
    if (err) {
      context.log("Error connecting to Azure SQL Database:", err);
      context.res = { status: 500, body: "Error connecting to database" };
      return;
    } else {
      context.log("Successfully connected to Azure SQL Database.");

      const sqlQuery =
        "INSERT INTO toc.BC_Tracking_Numbers (is_processed, order_status, insert_timestamp, BC_orderid) VALUES (@IsProcessed, @OrderStatus, @InsertTimestamp, @BC_orderid)";

      const request = new Request(sqlQuery, (err) => {
        if (err) {
          context.log("Error executing query:", err);
          return;
        }
      });
      context.log("Query executed successfully.");

      request.addParameter("IsProcessed", TYPES.Bit, 0);
      request.addParameter("OrderStatus", TYPES.Int, 1);
      request.addParameter("InsertTimestamp", TYPES.DateTime, new Date());
      request.addParameter("BC_orderid", TYPES.VarChar, orderId);

      connection.execSql(request);
    }
  });
  connection.connect();

  try {
    const { resources: items } = await container.items
      .query({
        query: "SELECT * FROM c WHERE c.orderId = @orderId",
        parameters: [{ name: "@orderId", value: orderId }],
      })
      .fetchAll();

    if (items.length > 0) {
      context.log("Item already exists in the database:", items[0].id);
      return;
    }

    const itemToUpsert = {
      orderId: orderId,
      ProcessedAt: new Date().getTime(),
    };

    const { resource: upsertedItem } = await container.items.upsert(itemToUpsert);
    context.log("Item upserted successfully:", upsertedItem.id);
  } catch (error) {
    context.log("An error occurred while processing the message:", error);
    throw error;
  }
};

// const checkOrder = async (record) => {
//   try {
//     const eventData = JSON.parse(record);

//     if (eventData && eventData.producer) {
//       context.log("Event data:", eventData);
//       const { data } = eventData;
//       const [, , eventType] = eventData.scope.split("/");

//       // const db = new DynamoDB.DocumentClient();
//       // const orderUpdateProcessingTable = process.env.ORDER_UPDATE_PROCESSING_TABLE;

//       let processCreated = false;
//       let order;
//       if (eventType === "created") {
//         const bigCommerce = new BigCommerce({
//           logLevel: "info",
//           clientId: process.env.BC_CLIENT_ID,
//           accessToken: process.env.BC_ACCESS_TOKEN,
//           storeHash: process.env.BC_STORE_HASH,
//           responseType: "json",
//           apiVersion: "v2",
//         });

//         const orderId = data.id;
//         const startTimeBigCommerce = new Date().getTime();
//         order = await bigCommerce.get(`/orders/${orderId}`);
//         context.info(`Total time taken to fetch order from BigCommerce : ${(new Date().getTime() - startTimeBigCommerce) / 1000} seconds`);
//         if (order.status_id === 11) processCreated = true;
//         else context.log("Order status id is not 11", JSON.stringify(order));
//       }

//       if ((data.id && eventType === "statusUpdated" && data.status?.new_status_id === 11) || processCreated) {
//         // Check the database to see if we recently processed this order
//         const startTimeDb = new Date().getTime();
//         // const item = await db
//         //   .get({
//         //     TableName: orderUpdateProcessingTable,
//         //     Key: {
//         //       OrderID: data.id,
//         //     },
//         //   })
//         //   .promise();
//         context.log(`Total time taken to fetch order from DynamoDB : ${(new Date().getTime() - startTimeDb) / 1000} seconds`);
//         const processedAt = item?.Item?.ProcessedAt;
//         const lastStatusID = item?.Item?.LastStatusID ? item?.Item?.LastStatusID : null;
//         const newStatusID = data.status?.new_status_id ? data.status?.new_status_id : order.status_id;
//         const delta = processedAt ? Math.abs(processedAt - new Date().getTime()) : null;
//         if (delta && delta < 300000) {
//           context.log(`Skipping Order Id ${data.id}, last processed at: ${processedAt}`);
//           return;
//         }
//         if (lastStatusID && lastStatusID === newStatusID) {
//           context.log(`Skipping Order Id ${data.id}, last status id: ${lastStatusID}`);
//           return;
//         }

//         // const cmsXml = await generateCmsXML([data.id]);
//         //
//         // await S3.send(new PutObjectCommand({
//         //   Bucket: process.env.CMS_FTP_BUCKET,
//         //   Key: `order-${data.id}.xml`,
//         //   ContentType: 'application/xml',
//         //   Body: cmsXml,
//         // }));

//         const startTimeEbridge = new Date().getTime();
//         // const eBridgeXmls = await generateEBridgeXMLs(data.id);
//         context.info(`Total time taken to generate eBridge XML : ${(new Date().getTime() - startTimeEbridge) / 1000} seconds`);
//         const promises = [];
//         const startTimeS3andEbridge = new Date().getTime();
//         for (const [index, eBridgeXml] of eBridgeXmls.entries()) {
//           // promises.push(
//           //   S3.send(
//           //     new PutObjectCommand({
//           //       Bucket: process.env.CMS_FTP_BUCKET,
//           //       Key: `to-ebridge/order-${data.id}-${Date.now()}-${index + 1}.xml`,
//           //       ContentType: "application/xml",
//           //       Body: eBridgeXml,
//           //     })
//           //   )
//           // );

//           const filename = eBridgeXmls.length == 1 ? `order-${data.id}.xml` : `order-${data.id}-${index + 1}.xml`;
//           // promises.push(
//           //   soapClient.SendFileAsync({
//           //     login: process.env.EBRIDGE_USERNAME,
//           //     password: process.env.EBRIDGE_PASSWORD,
//           //     content: eBridgeXml,
//           //     filename: filename,
//           //   })
//           // );
//         }
//         await Promise.all(promises);
//         context.log(`Total time taken to send to S3 and eBridge : ${(new Date().getTime() - startTimeS3andEbridge) / 1000} seconds`);
//         context.log("Sent to eBridge");

//         // Log that we processed this order
//         const startTimeDbPut = new Date().getTime();
//         // await db
//         //   .put({
//         //     TableName: orderUpdateProcessingTable,
//         //     Item: {
//         //       OrderID: data.id,
//         //       ProcessedAt: new Date().getTime(),
//         //       LastStatusID: newStatusID,
//         //     },
//         //   })
//         //   .promise();
//         context.log(`Total time taken to put order to DynamoDB : ${(new Date().getTime() - startTimeDbPut) / 1000} seconds`);
//       }
//     }
//     context.log(`Total time taken to process order : ${(new Date().getTime() - startTime) / 1000} seconds`);
//   } catch (error) {
//     context.log("Error processing order", error);
//   }
// };

// const fetchBigCommerceOrderData = async (orderId) => {
//   const bigCommerce = new BigCommerce({
//     logLevel: "info",
//     clientId: process.env.BC_CLIENT_ID,
//     accessToken: process.env.BC_ACCESS_TOKEN,
//     storeHash: process.env.BC_STORE_HASH,
//     responseType: "json",
//     apiVersion: "v2",
//   });

//   const startTimeBigCommerceProductAndCouponsDetails = new Date().getTime();
//   const [order, productCount, shippingAddresses, coupons] = await Promise.all([
//     bigCommerce.get(`/orders/${orderId}`),
//     bigCommerce.get(`/orders/${orderId}/products/count`),
//     bigCommerce.get(`/orders/${orderId}/shipping_addresses`),
//     bigCommerce.get(`/orders/${orderId}/coupons`),
//   ]);
//   console.info(
//     `Total time taken to fetch order, product count, shipping addresses and coupons from BigCommerce : ${
//       (new Date().getTime() - startTimeBigCommerceProductAndCouponsDetails) / 1000
//     } seconds`
//   );

//   const productLimit = 200;
//   const pages = Math.ceil(productCount.count / productLimit);
//   const startTimeBigCommerceProducts = new Date().getTime();
//   const productResponses = await Promise.all(
//     Array.from(Array(pages)).map((_, i) => bigCommerce.get(`/orders/${orderId}/products?limit=${productLimit}&page=${i + 1}`))
//   );
//   console.info(`Total time taken to fetch products from BigCommerce : ${(new Date().getTime() - startTimeBigCommerceProducts) / 1000} seconds`);
//   const products = productResponses.flat();

//   return { order, products, shippingAddresses, coupons };
// };

// /**
//  * Will generate one or more eBridge XML strings for a single order, one per shipping address
//  *
//  * @param orderId
//  * @returns {Promise<string[]>}
//  */
// export const generateEBridgeXMLs = async (orderId) => {
//   const { order, products, shippingAddresses, coupons } = await fetchBigCommerceOrderData(orderId);

//   const xmlDocs = [];

//   const ghostBins = new Set([
//     "LOUS-2DD",
//     "LOUS-4DD",
//     "LOUS-6DD",
//     "LOUS-2TH1DD",
//     "LOUS-2TH5DD",
//     "LOUS-4TH",
//     "LOUS-6TH",
//     "LOUS-6DDTH",
//     "LOUS-2TH5DD",
//     "LOUS-7TH",
//   ]);

//   // Calculate percentages of total that a shipping address represents, used to assign
//   // partial payment and discount amounts
//   const totalsByShippingAddress = {};
//   products.forEach((product) => {
//     if (!(product.order_address_id in totalsByShippingAddress)) totalsByShippingAddress[product.order_address_id] = 0;

//     totalsByShippingAddress[product.order_address_id] += Number(product.total_inc_tax);
//   });

//   const totals = [];
//   shippingAddresses.forEach((shippingAddress) => {
//     // There have been scenarios with no products in a shipment
//     totals.push(shippingAddress.id in totalsByShippingAddress ? totalsByShippingAddress[shippingAddress.id] : 0);
//   });

//   const totalProductCost = totals.reduce((a, b) => {
//     return a + b;
//   }, 0);
//   const addressPercentages = totals.map((x) => (totalProductCost > 0 ? x / totalProductCost : 1));

//   shippingAddresses.forEach((shippingAddress, shippingAddressIndex) => {
//     let shipCode;
//     let shipDate;
//     let giftMessage;
//     let orderType = "WEB";
//     let tntDays = 3;
//     shippingAddress.form_fields.forEach((field) => {
//       if (field.name === "shipCode" && field.value) {
//         shipCode = field.value;
//       } else if (field.name === "shipDate" && field.value && !isNaN(Date.parse(field.value))) {
//         shipDate = new Date(field.value);
//       } else if (field.name === "Gift Message" && field.value) {
//         giftMessage = field.value;
//       } else if (field.name === "orderType" && field.value) {
//         orderType = field.value.toUpperCase();
//       } else if (field.name === "tntDays" && field.value && field.value > 0 && !isNaN(field.value)) {
//         tntDays = field.value;
//       }
//     });

//     if (!shipDate) shipDate = new Date(order.date_created);
//     if (!shipCode) shipCode = "UGD";

//     const shipToContacts = [];
//     if (shippingAddress.phone) shipToContacts.push(getPhoneContact(shippingAddress.phone));

//     if (shippingAddress.email) shipToContacts.push(getEmailContact(shippingAddress.email));

//     const billToContacts = [];
//     if (order.billing_address.phone) billToContacts.push(getPhoneContact(order.billing_address.phone));

//     if (order.billing_address.email) billToContacts.push(getEmailContact(order.billing_address.email));

//     const shippingAddressProducts = products.filter((product) => product.order_address_id === shippingAddress.id);

//     // General product map by id
//     const productIdMap = shippingAddressProducts.reduce((map, product) => {
//       map[product.id] = product;
//       return map;
//     }, {});

//     // Generate all the line items by bundle parent (everything is considered to be a bundle to simplify things)
//     // Also total up how many items in a single bundle, so that we can get the unit price
//     const bundleItems = {};
//     const bundleQuantity = {};
//     shippingAddressProducts.forEach((product) => {
//       const parentId = product.parent_order_product_id ? product.parent_order_product_id : product.id;
//       if (!(parentId in bundleItems)) {
//         bundleItems[parentId] = [];
//         bundleQuantity[parentId] = 0;
//       }

//       const bins = product.bin_picking_number.split(",");

//       // Sometimes bins will have something like "HOME-CHEESE, HOME-CHEESE,HOME-RONI",
//       // need to reduce it to 2 HOME-CHEESE, and 1 HOME-RONI
//       const combinedBins = Object.values(
//         bins.reduce((prev, curr) => {
//           const bin = curr.trim();
//           if (!(bin in prev)) prev[bin] = { bin, quantity: 0 };

//           prev[bin].quantity += 1;
//           return prev;
//         }, {})
//       );

//       combinedBins.forEach((obj) => {
//         const { bin, quantity } = obj;
//         if (ghostBins.has(bin)) return;

//         bundleItems[parentId].push({
//           product,
//           bin,
//           quantity: product.quantity * quantity,
//         });

//         bundleQuantity[parentId] += product.quantity * quantity;
//       });
//     });

//     // Generate the Shipment info string, that tells GP which items needs to be shipped for the write back.
//     // We just need to ship the parent items
//     // const shipItems = [];
//     // shippingAddressProducts.forEach(product => {
//     //   shipItems.push(`${product.sku}:${product.quantity}`);
//     // });
//     // const shipmentInfoStr = shipItems.join(";");
//     // const shipmentInfoStrParts = shipmentInfoStr.match(/.{1,200}/g);

//     // Generate the XML for each line item - loop over shippingAddressProducts instead of bundle items, because I want
//     // to preserve the order
//     const productObjs = [];
//     shippingAddressProducts.forEach((product) => {
//       // Only want the bundle parents
//       if (!(product.id in bundleItems)) return;

//       const parentId = product.id;
//       const items = bundleItems[parentId];
//       const parent = productIdMap[parentId];
//       items.forEach((item) => {
//         const unitPrice = parent.total_ex_tax / bundleQuantity[parentId];

//         const productObj = {
//           BaseItemDetail: {
//             LineItemNum: {
//               "core:BuyerLineItemNum": productObjs.length + 1,
//             },
//             ItemIdentifiers: {
//               "core:PartNumbers": {
//                 "core:SellerPartNumber": {
//                   "core:PartID": item.bin,
//                 },
//               },
//             },
//             TotalQuantity: {
//               "@xsi:type": "core:QuantityType",
//               "core:QuantityValue": item.quantity,
//             },
//           },
//           PricingDetail: {
//             "core:ListOfPrice": {
//               "core:Price": {
//                 "core:UnitPrice": {
//                   "core:UnitPriceValue": unitPrice.toFixed(4),
//                 },
//               },
//             },
//           },
//         };

//         if (items.length > 1) {
//           productObj["ListOfNameValueSet"] = {
//             "core:NameValueSet": {
//               "core:SetName": "DetailReferences",
//               "core:ListOfNameValuePair": {
//                 "core:NameValuePair": [
//                   {
//                     "core:Name": "DetailComment",
//                     "core:Value": parent.bin_picking_number,
//                   },
//                 ],
//               },
//             },
//           };
//         }

//         productObjs.push(productObj);
//       });
//     });

//     // Check if any item is a subscription item
//     let isSubscription = false;
//     shippingAddressProducts.forEach((product) => {
//       if (product.bin_picking_number.startsWith("POM") || product.bin_picking_number.startsWith("PBM")) isSubscription = true;
//     });

//     let isGiftCard =
//       shippingAddressProducts.length > 0 && shippingAddressProducts.every((product) => ["PGC", "PGC-LM"].includes(product.bin_picking_number));
//     let isVirtualGiftCard =
//       shippingAddressProducts.length > 0 && shippingAddressProducts.every((product) => ["VGC", "VGC-LM"].includes(product.bin_picking_number));

//     let batchNumber = `WEB_${format(new Date(shipDate.valueOf() + shipDate.getTimezoneOffset() * 60 * 1000), "MMddyyyy")}`;
//     let paymentAmount = Number(order.total_inc_tax * addressPercentages[shippingAddressIndex]).toFixed(4);
//     let userDefined5 = paymentAmount;
//     if (orderType.toUpperCase() != "WEB") batchNumber = orderType;
//     if (isSubscription) {
//       orderType = "SUBSCRIPTION";
//       batchNumber = "SUBSCRIPTION";
//       paymentAmount = "0.000";
//     }
//     if (isGiftCard) {
//       orderType = "GIFTCARD";
//       batchNumber = "GIFTCARD";
//     }
//     if (isVirtualGiftCard) {
//       orderType = "EGIFTCARD";
//       batchNumber = "EGIFTCARD";
//     }

//     const obj = {
//       Order: {
//         "@xmlns": "rrn:org.xcbl:schemas/xcbl/v4_0/ordermanagement/v1_0/ordermanagement.xsd",
//         "@xmlns:core": "rrn:org.xcbl:schemas/xcbl/v4_0/core/core.xsd",
//         "@xmlns:dgs": "http://www.w3.org/2000/09/xmldsig#",
//         "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
//         OrderHeader: {
//           OrderNumber: {
//             BuyerOrderNumber: order.id,
//             SellerOrderNumber: shippingAddresses.length == 1 ? order.id : `${order.id}-${shippingAddressIndex + 1}`,
//           },
//           OrderIssueDate: new Date(order.date_created).toISOString(),
//           OrderDates: {
//             RequestedShipByDate: format(new Date(shipDate.valueOf() + shipDate.getTimezoneOffset() * 60 * 1000), "yyyy-MM-dd"),
//           },
//           OrderParty: {
//             ShipToParty: {
//               "@xsi:type": "core:PartyType",
//               "core:ListOfIdentifier": {
//                 "core:Identifier": {
//                   "core:Ident": "PRIMARY",
//                 },
//               },
//               "core:NameAddress": {
//                 "core:Name1": `${shippingAddress.first_name} ${shippingAddress.last_name}`.toUpperCase(),
//                 "core:Street": shippingAddress.street_1.toUpperCase(),
//                 "core:StreetSupplement1": shippingAddress.street_2 ? shippingAddress.street_2.toUpperCase() : undefined,
//                 "core:PostalCode": shippingAddress.zip,
//                 "core:City": shippingAddress.city.toUpperCase(),
//                 "core:Region": {
//                   "core:RegionCoded": "Other",
//                   "core:RegionCodedOther": states[shippingAddress.state],
//                 },
//                 "core:Country": {
//                   "core:CountryCoded": "Other",
//                   "core:CountryCodedOther": shippingAddress.country_iso2,
//                 },
//               },
//               "core:PrimaryContact": {
//                 "core:ContactName": shippingAddress.company ? shippingAddress.company.toUpperCase() : undefined,
//                 "core:ListOfContactNumber": {
//                   "core:ContactNumber": shipToContacts,
//                 },
//               },
//             },
//             BillToParty: {
//               "@xsi:type": "core:PartyType",
//               "core:ListOfIdentifier": {
//                 "core:Identifier": {
//                   "core:Ident": "PRIMARY",
//                 },
//               },
//               "core:NameAddress": {
//                 "core:Name1": `${order.billing_address.first_name} ${order.billing_address.last_name}`.toUpperCase(),
//                 "core:Street": order.billing_address.street_1.toUpperCase(),
//                 "core:StreetSupplement1": order.billing_address.street_2 ? order.billing_address.street_2.toUpperCase() : undefined,
//                 "core:PostalCode": order.billing_address.zip,
//                 "core:City": order.billing_address.city.toUpperCase(),
//                 "core:Region": {
//                   "core:RegionCoded": "Other",
//                   "core:RegionCodedOther": states[order.billing_address.state],
//                 },
//                 "core:Country": {
//                   "core:CountryCoded": "Other",
//                   "core:CountryCodedOther": order.billing_address.country_iso2,
//                 },
//               },
//               "core:PrimaryContact": {
//                 "core:ContactName": order.billing_address.company ? order.billing_address.company.toUpperCase() : undefined,
//                 "core:ListOfContactNumber": {
//                   "core:ContactNumber": billToContacts,
//                 },
//               },
//             },
//             WarehouseParty: {
//               "core:ListOfIdentifier": {
//                 "core:Identifier": {
//                   "core:Ident": "MAIN",
//                 },
//               },
//             },
//             BuyerParty: {
//               "core:PartyID": {
//                 "core:Ident": "Lou Malnatis Pizzeria Big Commerce",
//               },
//               "core:ListOfIdentifier": {
//                 "core:Identifier": {
//                   "core:Ident": "Lou Malnatis Pizzeria Big Commerce",
//                 },
//               },
//             },
//             SellerParty: {
//               "core:PartyID": {
//                 "core:Ident": "8475621814",
//               },
//               "core:ListOfIdentifier": {
//                 "core:Identifier": {
//                   "core:Ident": "8475621814",
//                 },
//               },
//             },
//           },
//           ListOfNameValueSet: {
//             "core:NameValueSet": [
//               {
//                 "core:SetName": "HeaderReferences",
//                 "core:ListOfNameValuePair": {
//                   "core:NameValuePair": [
//                     {
//                       "core:Name": "SOPType",
//                       "core:Value": "2",
//                     },
//                     {
//                       "core:Name": "DocumentTypeId",
//                       "core:Value": orderType,
//                     },
//                     {
//                       "core:Name": "BatchNumber",
//                       "core:Value": batchNumber,
//                     },
//                     {
//                       "core:Name": "ShipToPrintPhone",
//                       "core:Value": "1",
//                     },
//                     {
//                       "core:Name": "CustomerId",
//                       "core:Value": order.customer_id,
//                     },
//                     {
//                       "core:Name": "UserDefinedText3",
//                       "core:Value": shippingAddress.id,
//                     },
//                     {
//                       "core:Name": "UserDefinedTable1",
//                       "core:Value": tntDays,
//                     },
//                   ],
//                 },
//               },
//               {
//                 "core:SetName": "TaxReferences",
//                 "core:ListOfNameValuePair": {
//                   "core:NameValuePair": [
//                     {
//                       "core:Name": "TaxAmount",
//                       "core:Value": Number(order.total_tax * addressPercentages[shippingAddressIndex]).toFixed(4),
//                     },
//                   ],
//                 },
//               },
//             ],
//           },
//           ListOfTransportRouting: {
//             "core:TransportRouting": {
//               "core:CarrierID": {
//                 "core:Ident": shipCode,
//               },
//             },
//           },
//           OrderAllowancesOrCharges: {
//             "core:AllowOrCharge": [
//               {
//                 "core:AllowanceOrChargeDescription": {
//                   "core:ServiceCodedOther": "Discount",
//                 },
//                 "core:TypeOfAllowanceOrCharge": {
//                   "core:MonetaryValue": {
//                     "core:MonetaryAmount": (
//                       (Number(order.discount_amount) + Number(order.coupon_discount)) *
//                       addressPercentages[shippingAddressIndex]
//                     ).toFixed(4),
//                   },
//                 },
//               },
//               {
//                 "core:AllowanceOrChargeDescription": {
//                   "core:ServiceCodedOther": "Freight",
//                 },
//                 "core:TypeOfAllowanceOrCharge": {
//                   "core:MonetaryValue": {
//                     "core:MonetaryAmount": (Number(order.shipping_cost_ex_tax) * addressPercentages[shippingAddressIndex]).toFixed(4),
//                   },
//                 },
//               },
//             ],
//           },
//         },
//         OrderDetail: {
//           ListOfItemDetail: {
//             ItemDetail: productObjs,
//           },
//         },
//       },
//     };

//     if (Number(paymentAmount) !== 0) {
//       obj["Order"]["OrderHeader"]["ListOfNameValueSet"]["core:NameValueSet"].push({
//         "core:SetName": "PaymentReferences",
//         "core:ListOfNameValuePair": {
//           "core:NameValuePair": [
//             {
//               "core:Name": "PaymentAmount",
//               "core:Value": paymentAmount,
//             },
//             {
//               "core:Name": "CheckBookID",
//               "core:Value": order.payment_method == "giftcertificate" ? "GIFTCARD" : "TOCCHASE",
//             },
//             {
//               "core:Name": "PaymentType",
//               "core:Value": 1,
//             },
//             {
//               "core:Name": "PaymentDate",
//               "core:Value": new Date(order.date_created).toISOString(),
//             },
//           ],
//         },
//       });
//     }

//     if (giftMessage && giftMessage.trim()) {
//       const parts = giftMessage.trim().match(/.{1,50}/g);
//       parts.slice(0, 3).forEach((part, index) => {
//         obj["Order"]["OrderHeader"]["ListOfNameValueSet"]["core:NameValueSet"][0]["core:ListOfNameValuePair"]["core:NameValuePair"].push({
//           "core:Name": `Comment${index + 1}`,
//           "core:Value": part,
//         });
//       });
//     }

//     if (Object.keys(coupons).length > 0) {
//       const couponStr = coupons.map((x) => x.code).join(",");
//       obj["Order"]["OrderHeader"]["ListOfNameValueSet"]["core:NameValueSet"][0]["core:ListOfNameValuePair"]["core:NameValuePair"].push({
//         "core:Name": `UserDefinedText1`,
//         "core:Value": couponStr,
//       });
//     }

//     if (isSubscription) {
//       obj["Order"]["OrderHeader"]["ListOfNameValueSet"]["core:NameValueSet"][0]["core:ListOfNameValuePair"]["core:NameValuePair"].push({
//         "core:Name": `UserDefinedText5`,
//         "core:Value": userDefined5,
//       });
//     }

//     const xmlDoc = create({ version: "1.0", encoding: "UTF-8" }, obj);
//     xmlDocs.push(xmlDoc.end({ prettyPrint: true }));
//   });

//   return xmlDocs;
// };

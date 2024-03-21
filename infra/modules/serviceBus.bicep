param appPrefix string
param location string

param serviceBusNamespaceName string = '${appPrefix}-sb-ns'
param serviceBusQueueName string = '${appPrefix}-sb-queue'

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2021-11-01' = {
  name: serviceBusNamespaceName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 1
  }
  properties: {}
}

resource serviceBusQueue 'Microsoft.ServiceBus/namespaces/queues@2021-11-01' = {
  parent: serviceBusNamespace
  name: serviceBusQueueName
  properties: {
    // requiresDuplicateDetection: true
    // requiresSession: true
    deadLetteringOnMessageExpiration: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    maxDeliveryCount: 10
  }
}

@description('Azure Service Bus Data Owner role ID for role assignment')
var azureServiceBusDataOwnerRoleId = '090c5cfd-751d-490a-894a-3ce6f1109419'

resource userIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appPrefix}-identity'
  location: location
}

@description('Assigns the Azure Service Bus Data Owner role to the user-assigned managed identity on the specified queue')
resource queueRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid('${serviceBusNamespace.name}${serviceBusQueue.name}', userIdentity.name, azureServiceBusDataOwnerRoleId)
  scope: serviceBusQueue
  properties: {
    principalId: userIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', azureServiceBusDataOwnerRoleId)
    principalType: 'ServicePrincipal'
  }
}

output serviceBusNamespaceName string = serviceBusNamespace.name
output serviceBusQueueName string = serviceBusQueue.name
output serviceBusUserIdentityId string = userIdentity.id
output serviceBusUserIdentityClientId string = userIdentity.properties.clientId
